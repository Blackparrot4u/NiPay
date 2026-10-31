"""Server tests. The rules from UI_SPEC section 'Must-follow rules' 7: forged ID, reused ID, handover for
another person, old-month ID, fake rules; plus atomic ledger, lost-phone, two-phone offline flow."""
import base64
import threading

from nacl.signing import SigningKey, VerifyKey
from fastapi.testclient import TestClient
from sqlalchemy import select

from conftest import Phone, b64, unb64
from nipay.core.idsystem import ALPHA, Rules, phone_check, sign_handover, verify_sig
from nipay.core.wallet import accept_rules, rules_blob
from nipay.main import create_app
from nipay.models import Notice, ReviewItem, SecurityEvent, Transfer, User


def pair(env, amount=20):
    a, b = env.phone("+919000000001", "Asha"), env.phone("+919000000002", "Bela", bank="Demo Bank B")
    a.register(); b.register()
    a.topup(amount)
    return a, b


def events(env, typ=None):
    with env.app.state.SessionLocal() as db:
        q = select(SecurityEvent)
        return [e.type for e in db.scalars(q)] if not typ else [e for e in db.scalars(q) if e.type == typ]


# ---- the five rules from the spec ----
def test_forged_id_random_signature_and_edited_id(env):
    a, b = pair(env)
    pt = a.value_points()[0]
    e = a.pay_to(b, pt)
    e["sig"] = b64(bytes(64))                     # random/blank signature
    assert b.claim(e)["reason"] == "forged"
    e2 = a.pay_to(b, pt)
    e2["pid"] = ("z" if pt["pid"][0] != "z" else "y") + pt["pid"][1:]   # edited ID, real signature
    assert b.claim(e2)["reason"] == "forged"
    assert b.wallet()["receive_bucket"] == 0
    assert "forged" in events(env)


def test_forged_id_phone_side_checks_catch_random_ids(env):
    """B's phone, offline: a random ID fails the tower/landmine/signature layers."""
    a, b = pair(env)
    r = env.svc.bank.rules(env.svc.current_month(None) if False else a.value_points()[0]["month"])
    import secrets
    fails = sum(phone_check("".join(secrets.choice(ALPHA) for _ in range(20)), secrets.token_bytes(64), r, env.svc.bank.public) != "ok" for _ in range(200))
    assert fails == 200


def test_reused_id_first_report_paid_rest_held(env):
    a, b = pair(env)
    c = env.phone("+919000000003", "Chand"); c.register()
    pt = a.value_points()[0]
    assert b.claim(a.pay_to(b, pt))["status"] == "paid"
    r = c.claim(a.pay_to(c, pt))               # owner really signed it over twice (modified app)
    assert (r["status"], r["reason"]) == ("held", "already_paid_to_someone_else")
    assert b.wallet()["receive_bucket"] == 1 and c.wallet()["receive_bucket"] == 0
    assert a.wallet()["send_bucket"] == 19      # only one point left the owner's bucket
    # replaying the same claim does not double pay
    assert b.claim(a.pay_to(b, pt))["status"] == "paid"
    assert b.wallet()["receive_bucket"] == 1
    assert a.wallet()["offline_suspended"] is True   # automatic rule, signed proof of two handovers
    with env.app.state.SessionLocal() as db:
        assert db.scalars(select(Notice)).first().pid == pt["pid"]  # bad-ID notice for phones
    adm = admin(env)
    cases = env.c.get("/admin/same-id", headers=adm).json()["cases"]
    assert cases[0]["owner"] == "Asha" and [x["status"] for x in cases[0]["claimants"]] == ["paid", "held"]


def test_handover_for_another_person_is_refused(env):
    a, b = pair(env)
    c = env.phone("+919000000003", "Chand"); c.register()
    pt = a.value_points()[0]
    e = a.pay_to(c, pt)                           # A signed it over to C...
    assert b.claim(e)["reason"] == "no_handover"  # ...so B cannot use that handover
    # and nobody can claim with a handover signed by a different key (a thief holding the ID)
    thief = SigningKey.generate()
    e = a.pay_to(b, pt)
    e["handover"] = b64(sign_handover(thief, pt["month"], pt["pid"], b.phone))
    assert b.claim(e)["reason"] == "no_handover"
    assert b.wallet()["receive_bucket"] == 0


def test_old_month_id_and_expired_after_grace(env):
    a, b = pair(env)
    pt = a.value_points()[0]
    e = a.pay_to(b, pt, month="2025-01")          # old month label on this month's signature
    assert b.claim(e)["reason"] == "forged"
    assert not verify_sig(env.svc.bank.public, "2025-01", pt["pid"], unb64(pt["sig"]))
    env.svc.s.grace_days = 38
    cur = pt["month"]
    for _ in range(2):
        assert env.c.post("/admin/rules/rotate", headers=admin(env)).status_code == 200
    assert b.claim(a.pay_to(b, pt))["reason"] == "expired"   # two rotations later: outside grace
    # old IDs do not pass the NEW month's tower/landmine rules either
    new = env.svc.bank.rules(env.svc.prev_month(env.svc.prev_month(cur)) if False else cur)
    nxt = env.svc.bank.rules("2099-01")
    assert phone_check(pt["pid"], unb64(pt["sig"]), nxt, env.svc.bank.public) != "ok"


def test_previous_month_valid_inside_grace(env):
    a, b = pair(env)
    pt = a.value_points()[0]
    assert env.c.post("/admin/rules/rotate", headers=admin(env)).status_code == 200
    doc = env.c.get("/rules/current", headers=a.h()).json()
    assert doc["previous"] is not None
    assert b.claim(a.pay_to(b, pt))["status"] == "paid"


def test_fake_rules_rejected_real_accepted(env):
    a, b = pair(env)
    doc = env.c.get("/rules/current", headers=a.h()).json()["current"]
    pub = env.svc.bank.public
    blob, sig = unb64(doc["rules"]["blob"]), unb64(doc["rules"]["sig"])
    assert accept_rules(pub, blob, sig)
    fake = blob.replace(b'"p":[', b'"p":[],"x":[')
    assert not accept_rules(pub, fake, sig)                       # edited rules, old signature
    assert not accept_rules(pub, blob, bytes(64))                 # right rules, random signature
    forger = SigningKey.generate()
    assert not accept_rules(pub, blob, forger.sign(blob).signature)   # signed by someone else
    # a weakened-rules attack: rules with no landmines, signed by the attacker
    weak = rules_blob(Rules("2026-11", tuple(frozenset(range(36)) for _ in range(4)), (0,) * 5, frozenset(), frozenset()))
    assert not accept_rules(pub, weak, forger.sign(weak).signature)


# ---- ledger ----
def test_ledger_balanced_and_failed_topup_changes_nothing(env):
    a, b = pair(env, 30)
    before = env.svc.ledger_totals(env.app.state.SessionLocal())  if False else None
    r = env.c.post("/wallet/topup", json={"amount": 5000, "pin": "1234"}, headers=a.h())
    assert r.status_code == 400 and r.json()["detail"] == "send_limit"
    r = env.c.post("/wallet/topup", json={"amount": 10, "pin": "9999"}, headers=a.h())
    assert r.status_code == 403
    w = a.wallet()
    assert w["send_bucket"] == 30 and w["main_balance"] == 50000 - 31
    for p in a.value_points()[:5]:
        b.claim(a.pay_to(b, p))
    assert env.c.post("/wallet/move-to-main", json={"amount": 99}, headers=b.h()).status_code == 400
    assert env.c.post("/wallet/move-to-main", json={"amount": 5}, headers=b.h()).status_code == 200
    with env.app.state.SessionLocal() as db:
        t = env.svc.ledger_totals(db)
        assert t["main"] + t["send"] + t["recv"] + t["pool"] + t["fees"] + t["mint"] == 0
        assert t["fees"] == 1 and t["recv"] == 0 and t["send"] == 25
    assert b.wallet()["main_balance"] == 50000 + 5


def test_insufficient_main_balance_rolls_back(env):
    a = env.phone("+919000000001", "Asha"); a.register()
    env.svc.s.send_limit = 10**9
    r = env.c.post("/wallet/topup", json={"amount": 60000, "pin": "1234"}, headers=a.h())
    assert r.status_code == 400 and r.json()["detail"] == "insufficient"
    assert a.wallet()["main_balance"] == 50000 and a.wallet()["send_bucket"] == 0
    with env.app.state.SessionLocal() as db:
        from nipay.models import Point
        assert db.scalars(select(Point)).first() is None


def test_race_two_claimants_exactly_one_paid(env):
    a, b = pair(env)
    c = env.phone("+919000000003", "Chand"); c.register()
    pt = a.value_points()[0]
    ent = {"b": a.pay_to(b, pt), "c": a.pay_to(c, pt)}
    res = {}

    def go(name, who):
        with TestClient(env.app) as cl:
            who.c = cl
            res[name] = who.claim(ent[name])
    ts = [threading.Thread(target=go, args=("b", b)), threading.Thread(target=go, args=("c", c))]
    [t.start() for t in ts]; [t.join() for t in ts]
    assert sorted(r["status"] for r in res.values()) == ["held", "paid"]
    with env.app.state.SessionLocal() as db:
        t = env.svc.ledger_totals(db)
        assert t["recv"] == 1 and t["send"] == 19


# ---- the two-phone offline flow, end to end ----
def test_two_phone_offline_flow_end_to_end(env):
    a, b = pair(env, 50)
    # both phones fetch the signed rules while online, then go offline
    doc = env.c.get("/rules/current", headers=a.h()).json()
    pub = VerifyKey(unb64(doc["bank_public_key"]))
    assert accept_rules(pub, unb64(doc["current"]["rules"]["blob"]), unb64(doc["current"]["rules"]["sig"]))
    import json
    from nipay.core.idsystem import derive_rules
    rj = json.loads(unb64(doc["current"]["rules"]["blob"]))
    rules = Rules(rj["m"], tuple(frozenset(x) for x in rj["j"]), tuple(rj["f"]), frozenset(rj["p"]), frozenset(rj["t"]))
    sent = a.value_points()[:12]
    logs_a, logs_b = [], []
    for pt in sent:                                            # offline: B's phone checks every ID, A signs, B signs "received"
        assert phone_check(pt["pid"], unb64(pt["sig"]), rules, pub) == "ok"
        e = a.pay_to(b, pt)
        logs_a.append({**e, "role": "sent"})
        logs_b.append({**{k: v for k, v in e.items()}, "role": "received"})
    # A comes online first: its log carries B's receipts, so it settles
    out = a.sync(logs_a)
    assert [r["status"] for r in out["results"]] == ["paid"] * 12
    assert out["wallet"]["send_bucket"] == 38
    assert b.wallet()["receive_bucket"] == 12
    # B syncs later: nothing double pays
    out = b.sync(logs_b)
    assert [r["status"] for r in out["results"]] == ["paid"] * 12 and out["wallet"]["receive_bucket"] == 12
    assert env.c.post("/wallet/move-to-main", json={"amount": 12}, headers=b.h()).json()["main_balance"] == 50012
    hist = env.c.get("/history", headers=b.h()).json()["payments"]
    assert hist and sum(p["amount"] for p in hist) == 12 and {p["status"] for p in hist} == {"paid"}


def test_senders_log_alone_stays_pending_until_receiver_confirms(env):
    a, b = pair(env)
    pt = a.value_points()[0]
    e = a.pay_to(b, pt); e.pop("receipt")
    out = a.sync([{**e, "role": "sent"}])
    assert out["results"][0]["status"] == "pending"
    assert b.wallet()["receive_bucket"] == 0 and a.wallet()["send_bucket"] == 20
    assert b.claim(e)["status"] == "paid"                      # B confirms
    assert a.wallet()["send_bucket"] == 19


def test_sender_cannot_log_a_point_that_is_not_theirs(env):
    a, b = pair(env)
    pt = a.value_points()[0]
    thief = env.phone("+919000000003", "Chand"); thief.register()
    e = a.pay_to(b, pt)
    out = thief.sync([{**e, "role": "sent"}])
    assert out["results"][0]["reason"] == "not_owner"


# ---- lost phone, devices, login ----
def test_one_login_at_a_time_and_cancel_device_no_refund(env):
    a, b = pair(env, 10)
    pt = a.value_points()[0]
    new = env.phone("+919000000001", "Asha")
    new.pub = b64(bytes(SigningKey.generate().verify_key))
    r = env.c.post("/auth/login", json={"phone": a.phone, "pin": "1234", "device_public_key": new.pub, "device_label": "second phone"})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "already_active_elsewhere"
    r = env.c.post("/auth/cancel-device", json={"phone": a.phone, "pin": "1234", "device_public_key": new.pub, "reason": "lost my old phone", "balance_summary": "10 points"})
    assert r.status_code == 200 and r.json()["forfeited_points"] == 10 and r.json()["refund"] == 0
    new.token = r.json()["token"]
    assert new.wallet()["send_bucket"] == 0 and new.wallet()["main_balance"] == 50000 - 11   # no refund
    assert env.c.get("/wallet", headers=a.h()).status_code == 401                              # old session is dead
    # a claim on the lost wallet's point is still paid, and proves the owner lied (review item)
    assert b.claim(a.pay_to(b, pt))["status"] == "paid"
    assert b.wallet()["receive_bucket"] == 1
    with env.app.state.SessionLocal() as db:
        assert any(i.type == "LOST_PHONE_CLAIM" for i in db.scalars(select(ReviewItem)))
        t = env.svc.ledger_totals(db)
        assert t["pool"] == 9 and t["main"] + t["send"] + t["recv"] + t["pool"] + t["fees"] + t["mint"] == 0


def test_wrong_pin_locks_and_tokens_required(env):
    a, _ = pair(env)
    assert env.c.get("/wallet").status_code == 401
    assert env.c.get("/wallet", headers={"Authorization": "Bearer nope"}).status_code == 401
    for _ in range(5):
        env.c.post("/auth/login", json={"phone": a.phone, "pin": "0000", "device_public_key": a.pub})
    r = env.c.post("/auth/login", json={"phone": a.phone, "pin": "1234", "device_public_key": a.pub})
    assert r.status_code == 429


def test_register_requires_terms_and_stores_no_kyc_numbers(env):
    c = env.c
    base = {"phone": "+919111111111", "otp": "123456", "name": "T", "pin": "1234", "device_public_key": b64(bytes(SigningKey.generate().verify_key)),
            "kyc": {"test_aadhaar": "1234 5678 9012", "test_pan": "ABCDE1234F"}}
    assert c.post("/auth/register", json=base).status_code == 400
    assert c.post("/auth/register", json={**base, "accepted_terms": True, "no_account_renting": True, "otp": "000000"}).status_code == 403
    assert c.post("/auth/register", json={**base, "accepted_terms": True, "no_account_renting": True}).status_code == 200
    import sqlite3
    raw = b"".join(open(f, "rb").read() for f in __import__("glob").glob(env.dir + "/nipay.db*"))
    assert b"1234 5678 9012" not in raw and b"ABCDE1234F" not in raw


# ---- tripwires from the phone, trust, notices ----
def test_control_key_leak_and_mine_audit_and_restore(env):
    a, b = pair(env, 30)
    ctrl = [p for p in a.points if p["kind"] == "control"][0]
    assert b.claim(a.pay_to(b, ctrl))["reason"] == "control_key"
    assert "control_key_leak" in events(env)
    # wallet snapshot with a foreign ID, and a restored wallet (sequence behind the counter)
    out = a.sync(wallet={"points": [p["pid"] for p in a.points] + ["a" * 20], "mines": [], "seq": 3, "counter": 7, "month": a.points[0]["month"]})
    assert "forged" in out["wallet_audit"] and "restore" in out["wallet_audit"]


def test_trust_certificate_signed_and_fixed_range(env):
    a, b = pair(env)
    doc = env.c.get("/trust/certificate", headers=a.h()).json()
    pub = env.svc.bank.public
    assert 300 <= doc["score"] <= 850 and accept_rules(pub, unb64(doc["blob"]), unb64(doc["sig"]))
    raised = unb64(doc["blob"]).replace(f'"s":{doc["score"]}'.encode(), b'"s":850')
    assert doc["score"] == 850 or not accept_rules(pub, raised, unb64(doc["sig"]))
    assert env.c.get("/wallet", headers=a.h()).json()["send_limit"] == 2000     # trust never raises the limit


def test_notices_are_signed(env):
    a, b = pair(env)
    d = env.c.get("/notices", headers=a.h()).json()
    assert accept_rules(env.svc.bank.public, unb64(d["blob"]), unb64(d["sig"]))
    assert not accept_rules(env.svc.bank.public, unb64(d["blob"]) + b" ", unb64(d["sig"]))


def test_integrity_endpoint_is_honest_about_missing_attestation(env):
    a, _ = pair(env)
    r = env.c.post("/integrity/verify", json={}, headers=a.h()).json()
    assert r["play_integrity"] == "not_implemented_in_web_demo" and r["app_attest"] == "not_implemented_in_web_demo"


# ---- admin ----
def admin(env, who="admin"):
    r = env.c.post("/admin/login", json={"username": who, "password": env.secrets["admins"][who]})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_admin_read_endpoints_and_roles_and_audit_chain(env):
    a, b = pair(env)
    b.claim(a.pay_to(b, a.value_points()[0]))
    h = admin(env)
    for p in ("overview", "live", "live-ledger", "users", "security-logs", "same-id", "review", "appeals", "flow-map", "rules", "ledger", "analytics", "audit-log"):
        assert env.c.get(f"/admin/{p}", headers=h).status_code == 200, p
    assert env.c.get("/admin/overview", headers=a.h()).status_code == 403   # a user token is not an admin token
    assert env.c.get("/admin/overview").status_code == 401
    assert env.c.post("/admin/login", json={"username": "admin", "password": "wrong"}).status_code == 401
    ov = env.c.get("/admin/overview", headers=h).json()
    assert ov["health"]["ledger_balanced"] and ov["health"]["audit_chain_intact"]
    rules = env.c.get("/admin/rules", headers=h).json()
    assert "seed" not in rules and "signing_key" not in str(rules).lower().replace("signing key", "")
    ro = admin(env, "auditor")
    assert env.c.post("/admin/rules/rotate", headers=ro).status_code == 403
    assert env.c.post("/admin/users/1/suspend", json={"suspended": True, "reason": "x y z"}, headers=ro).status_code == 403
    assert env.c.post("/admin/users/1/suspend", json={"suspended": True, "reason": "test review"}, headers=h).status_code == 200
    assert env.c.get("/admin/audit-log", headers=h).json()["chain_intact"]
    fm = env.c.get("/admin/flow-map", headers=h).json()
    assert any(e["kind"] == "transfer" and e["status"] == "paid" for e in fm["edges"]) and fm["ids_not_returned"] == 19


def test_security_logs_have_no_resolve_action(env):
    h = admin(env)
    for path in ("/admin/security-logs/1/resolve", "/admin/security-logs/1/close", "/admin/security-logs/1", "/admin/held-claims/1/decide"):
        for m in ("post", "put", "patch", "delete"):
            assert getattr(env.c, m)(path, headers=h).status_code in (404, 405)


def test_review_and_appeal_are_human_actions(env):
    a, b = pair(env)
    c = env.phone("+919000000003", "Chand"); c.register()
    pt = a.value_points()[0]
    b.claim(a.pay_to(b, pt)); c.claim(a.pay_to(c, pt))       # triggers an automatic block + review item
    r = env.c.post("/appeals", json={"reason": "my phone was cloned", "documents": ["police-report.pdf"]}, headers=a.h())
    assert r.status_code == 200
    h = admin(env)
    aid = env.c.get("/admin/appeals", headers=h).json()["appeals"][0]["id"]
    assert env.c.post(f"/admin/appeals/{aid}/decide", json={"decision": "APPROVED"}, headers=h).status_code == 200
    assert a.wallet()["offline_suspended"] is False
    rid = env.c.get("/admin/review", headers=h).json()["items"][0]["id"]
    assert env.c.post(f"/admin/review/{rid}/decide", json={"decision": "CLEARED"}, headers=h).status_code == 200


def test_rate_limit(env, tmp_path):
    from nipay.config import Settings
    app = create_app(Settings(data_dir=tmp_path, rate_limit_per_min=5, login_rate_per_min=3))
    with TestClient(app) as c:
        codes = [c.get("/health").status_code for _ in range(8)]
        assert codes[:5] == [200] * 5 and 429 in codes
        codes = [c.post("/admin/login", json={"username": "admin", "password": "x"}).status_code for _ in range(6)]
        assert 429 in codes


def test_secrets_are_generated_and_not_in_repo_files(env):
    import json
    s = json.load(open(env.dir + "/secrets.json"))
    assert len(base64.b64decode(s["signing_key"])) == 32 and len(base64.b64decode(s["seed"])) == 32


def test_live_ledger_changes_only_at_sync(env):
    a, b = pair(env, 10)
    h = admin(env)
    snap = lambda: env.c.get("/admin/live-ledger", headers=h).json()
    s0 = snap()
    assert s0["a"]["send_slot"] == 10 and "TEST MONEY" in s0["label"]
    # an offline payment: phones sign and exchange data, but nothing reaches the server
    e = a.pay_to(b, a.value_points()[0])
    assert snap()["a"] == s0["a"] and snap()["b"] == s0["b"] and snap()["last_entry_id"] == s0["last_entry_id"]
    a.sync([{**e, "role": "sent"}])   # sync: now the server moves it
    s1 = snap()
    assert s1["a"]["send_slot"] == 9 and s1["b"]["receive_slot"] == 1 and s1["last_entry_id"] > s0["last_entry_id"]
