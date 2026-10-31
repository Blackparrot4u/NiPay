"""Bank-side logic: issuing, claims, the atomic ledger, trust, notices, flow map.

Money is integer rupees = points (1 point = Rs 1). Everything here runs inside one database
transaction per request; the caller commits, so a failed step leaves no half-moved money.
"""
import base64
import hashlib
import json
from datetime import datetime, timedelta, timezone

from nacl.signing import SigningKey, VerifyKey
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from .config import Settings
from .core.idsystem import Bank, make_id, sign_handover, verify_handover, verify_receipt, verify_sig
from .core.wallet import Wallet, HardwareCounter, audit_mines, mine_recipe, rules_blob, sign_rules, sign_trust
from .models import (AuditLog, CrossReport, Device, LedgerEntry, Notice, Point, ReviewItem, SecurityEvent, Setting,
                     SettlementBatch, Transfer, User, now)


def b64(b: bytes) -> str:
    return base64.b64encode(b).decode()


def unb64(s: str) -> bytes:
    try:
        return base64.b64decode(s, validate=True)
    except Exception:
        return b""


class Rejected(Exception):
    def __init__(self, code: str):
        self.code = code


class Svc:
    def __init__(self, settings: Settings, secrets_store: dict):
        self.s = settings
        self.bank = Bank(seed=unb64(secrets_store["seed"]), signing=SigningKey(unb64(secrets_store["signing_key"])))
        self.pub_b64 = b64(bytes(self.bank.public))

    # ---------- small settings store ----------
    def get_setting(self, db, key: str, default: str | None = None) -> str | None:
        row = db.get(Setting, key)
        return row.value if row else default

    def put_setting(self, db, key: str, value: str):
        row = db.get(Setting, key)
        if row:
            row.value = value
        else:
            db.add(Setting(key=key, value=value))

    # ---------- months ----------
    CLAIM_MONTHS = 6  # an honest late claim stays valid for up to 6 months (phones still only accept the grace window offline)

    def claim_month_ok(self, db, month: str) -> bool:
        cur = self.current_month(db)
        if len(month) != 7 or month > cur:
            return False
        y, m = int(month[:4]), int(month[5:])
        cy, cm = int(cur[:4]), int(cur[5:])
        return (cy * 12 + cm) - (y * 12 + m) <= self.CLAIM_MONTHS

    def current_month(self, db) -> str:
        row = db.get(Setting, "month_override")
        return row.value if row else datetime.now(timezone.utc).strftime("%Y-%m")

    @staticmethod
    def prev_month(m: str) -> str:
        y, mo = int(m[:4]), int(m[5:])
        return f"{y - 1}-12" if mo == 1 else f"{y}-{mo - 1:02d}"

    def rotated_at(self, db) -> datetime:
        row = db.get(Setting, "rotated_at")
        if row:
            return datetime.fromisoformat(row.value)
        return datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    def month_valid(self, db, month: str) -> bool:
        """Current month, or last month while inside the grace period after the monthly rotation."""
        cur = self.current_month(db)
        if month == cur:
            return True
        if month == self.prev_month(cur):
            return (datetime.now(timezone.utc) - self.rotated_at(db)).days <= self.s.grace_days
        return False

    def rotate(self, db) -> str:
        nxt = self.current_month(db)
        y, mo = int(nxt[:4]), int(nxt[5:])
        nxt = f"{y + 1}-01" if mo == 12 else f"{y}-{mo + 1:02d}"
        for k, v in (("month_override", nxt), ("rotated_at", now().isoformat())):
            row = db.get(Setting, k)
            if row:
                row.value = v
            else:
                db.add(Setting(key=k, value=v))
        return nxt

    # ---------- signed documents ----------
    def signed(self, blob: bytes) -> dict:
        return {"blob": b64(blob), "sig": b64(self.bank.signing.sign(blob).signature)}

    def rules_doc(self, db, month: str) -> dict:
        r = self.bank.rules(month)
        blob, sig = sign_rules(self.bank, r)
        rec = mine_recipe(self.bank.seed, month)
        mine = json.dumps({"m": month, "pos": list(rec.positions), "t": rec.target}, separators=(",", ":")).encode()
        pol = json.dumps({"m": month, "send": self.s.send_limit, "recv": self.s.receive_limit,
                          "grace": self.s.grace_days}, separators=(",", ":")).encode()
        return {"month": month, "rules": {"blob": b64(blob), "sig": b64(sig)}, "mine": self.signed(mine),
                "policy": self.signed(pol)}

    def notices_doc(self, db) -> dict:
        pids = [n.pid for n in db.scalars(select(Notice).order_by(Notice.id))]
        blob = json.dumps({"bad": pids, "t": now().isoformat()}, separators=(",", ":")).encode()
        return self.signed(blob)

    # ---------- events / audit ----------
    def event(self, db, type_: str, sev: str, user_id=None, pid="", desc="", source="sync"):
        ev = SecurityEvent(type=type_, severity=sev, user_id=user_id, pid=pid, description=desc, source=source)
        db.add(ev)
        return ev

    def audit(self, db, actor: str, role: str, action: str, target: str = "", ip: str = ""):
        last = db.scalars(select(AuditLog).order_by(AuditLog.id.desc()).limit(1)).first()
        prev = last.row_hash if last else ""
        row = AuditLog(actor=actor, role=role, action=action, target=target, ip=ip, prev_hash=prev, ts=now())
        row.row_hash = hashlib.sha256(f"{prev}|{row.ts.isoformat()}|{actor}|{role}|{action}|{target}".encode()).hexdigest()
        db.add(row)

    def audit_chain_ok(self, db) -> bool:
        prev = ""
        for r in db.scalars(select(AuditLog).order_by(AuditLog.id)):
            h = hashlib.sha256(f"{prev}|{r.ts.isoformat()}|{r.actor}|{r.role}|{r.action}|{r.target}".encode()).hexdigest()
            if r.prev_hash != prev or r.row_hash != h:
                return False
            prev = h
        return True

    # ---------- atomic ledger ----------
    def move(self, db, kind: str, user: User | None, ref="", main=0, send=0, recv=0, pool=0, fees=0, mint=0, other: User | None = None):
        """One ledger entry. Its parts must sum to zero (nothing is created or lost) and no bucket may go negative."""
        assert main + send + recv + pool + fees + mint == 0, "unbalanced ledger entry"
        if user is not None:
            if user.main_balance + main < 0 or user.send_bucket + send < 0 or user.receive_bucket + recv < 0:
                raise Rejected("insufficient")
            user.main_balance += main
            user.send_bucket += send
            user.receive_bucket += recv
        db.add(LedgerEntry(kind=kind, user_id=user.id if user else None, ref=ref, d_main=main, d_send=send, d_recv=recv,
                           d_pool=pool, d_fees=fees, d_mint=mint, other_user_id=other.id if other else None))

    def ledger_totals(self, db) -> dict:
        q = lambda col: db.scalar(select(func.coalesce(func.sum(col), 0)))
        users = lambda col: db.scalar(select(func.coalesce(func.sum(col), 0)))
        return {"main": users(User.main_balance), "send": users(User.send_bucket), "recv": users(User.receive_bucket),
                "pool": q(LedgerEntry.d_pool), "fees": q(LedgerEntry.d_fees), "mint": q(LedgerEntry.d_mint)}

    # ---------- registration / top-up ----------
    def grant_test_funds(self, db, user: User):
        self.move(db, "test_funds", user, ref="fake money", main=self.s.test_funds, mint=-self.s.test_funds)

    def send_limit_for(self, db, device: Device | None) -> int:
        """A phone without a hardware counter gets a lower limit instead of a mark. The browser demo's counter is simulated, so it counts as weak;
        the demo setting keeps the full limit so the 2,000-point test can run (set NIPAY_WEAK_COUNTER_LIMIT lower for a stricter run)."""
        kind = self.get_setting(db, f"counter:{device.id}", "none") if device is not None else "none"
        return self.s.send_limit if kind == "hardware" else min(self.s.send_limit, self.s.weak_counter_send_limit)

    def topup(self, db, user: User, device: Device, amount: int, unsynced_spent: int = 0) -> list:
        if amount <= 0:
            raise Rejected("bad_amount")
        limit = self.send_limit_for(db, device)
        # Points the phone already spent offline stay in send_bucket until their logs reach the bank, so counting them would stall a refill.
        # The phone says how many it has spent but not yet synced; that only counts up to what the bank can see is outstanding, and the
        # hard ceiling (twice the limit) bounds the bank's exposure if a phone lies. A false report is logged.
        spent = max(0, min(int(unsynced_spent or 0), user.send_bucket))
        if spent:
            self.event(db, "topup_unsynced_spend", "LOW", user.id, "", f"refill with {spent} points spent offline and not yet synced")
        if user.send_bucket - spent + amount > limit or user.send_bucket + amount > 2 * limit:
            raise Rejected("send_limit")
        if user.offline_suspended:
            raise Rejected("offline_suspended")
        month = self.current_month(db)
        has_control = db.scalar(select(func.count()).select_from(Point).where(
            Point.owner_id == user.id, Point.device_id == device.id, Point.kind == "control", Point.month == month))
        # ledger first: it raises before any ID exists if the money is not there
        self.move(db, "topup", user, ref=f"{amount} points", main=-(amount + self.s.topup_fee), send=amount, fees=self.s.topup_fee)
        rules, out = self.bank.rules(month), []
        need = amount + (0 if has_control else 1)
        for i in range(need):
            kind = "control" if (i == 0 and not has_control) else "value"
            pid = make_id(rules)
            while db.scalar(select(Point.id).where(Point.month == month, Point.pid == pid)):
                pid = make_id(rules)
            sig = b64(self.bank.signing.sign(f"{month}|{pid}".encode()).signature)
            db.add(Point(month=month, pid=pid, sig=sig, kind=kind, owner_id=user.id, device_id=device.id))
            out.append({"pid": pid, "month": month, "sig": sig, "kind": kind})
        return out

    def move_to_main(self, db, user: User, amount: int):
        if amount <= 0 or amount > user.receive_bucket:
            raise Rejected("bad_amount")
        self.move(db, "move_to_main", user, ref=f"{amount}", recv=-amount, main=amount)

    # ---------- device cancel (lost phone / second login) ----------
    def cancel_other_devices(self, db, user: User, reason: str, keep_device_id: int | None = None) -> int:
        """Old devices are cancelled. Their unspent points are forfeited to the bank (no refund),
        but valid claims on them are still paid later."""
        forfeited = 0
        for dev in db.scalars(select(Device).where(Device.user_id == user.id, Device.active == True)):  # noqa: E712
            if dev.id == keep_device_id:
                continue
            dev.active, dev.cancelled_at, dev.cancel_reason = False, now(), reason[:500]
            for p in db.scalars(select(Point).where(Point.device_id == dev.id, Point.status == "issued")):
                p.status = "cancelled"
                if p.kind == "value":
                    forfeited += 1
        if forfeited:
            self.move(db, "lost_phone_forfeit", user, ref=reason[:50], send=-forfeited, pool=forfeited)
        return forfeited

    # ---------- claims ----------
    def process_transfer(self, db, actor: User, role: str, e: dict) -> dict:
        """One handover from a log. role='claimant' is the receiver's own claim; role='sender' is the
        owner's log, which stays pending until the receiver's signed receipt arrives."""
        month, pid = str(e.get("month", "")), str(e.get("pid", ""))
        sig, handover, receipt = unb64(e.get("sig", "")), unb64(e.get("handover", "")), unb64(e.get("receipt", ""))
        res = {"month": month, "pid": pid}

        def fail(code, ev_type=None, desc=""):
            if ev_type:
                self.event(db, ev_type, "CRITICAL" if ev_type == "forged" else "HIGH", actor.id, pid, desc or code)
            return {**res, "status": "rejected", "reason": code}

        if len(pid) != 20 or not verify_sig(self.bank.public, month, pid, sig):
            return fail("forged", "forged", "bank signature missing or wrong (wrong month, edited ID or random signature)")
        pt = db.scalars(select(Point).where(Point.month == month, Point.pid == pid)).first()
        if pt is None:
            return fail("forged", "forged", "valid-looking signature on an ID the bank never issued")
        if not self.claim_month_ok(db, month):
            return fail("expired")
        if pt.kind == "control":
            return fail("control_key", "control_key_leak", "control key appeared in a payment: the whole wallet list was copied")
        owner = db.get(User, pt.owner_id)
        if role == "claimant":
            to_user, from_user = actor, owner
            if actor.id == owner.id:
                return fail("self_claim")
        else:
            from_user = actor
            if pt.owner_id != actor.id:
                return fail("not_owner", "forged", "log claims to hand over a point that belongs to someone else")
            to_user = db.scalars(select(User).where(User.phone == str(e.get("to_phone", "")))).first()
            if to_user is None or to_user.id == actor.id:
                return fail("unknown_recipient")
        dev = db.get(Device, pt.device_id)
        owner_pub = VerifyKey(unb64(dev.public_key))
        if not verify_handover(owner_pub, month, pid, to_user.phone, handover):
            return fail("no_handover", "forged", "handover not signed by the owner's device for this recipient")
        confirmed = role == "claimant"
        if role == "sender" and receipt:
            for rd in db.scalars(select(Device).where(Device.user_id == to_user.id)):
                if verify_receipt(VerifyKey(unb64(rd.public_key)), month, pid, from_user.phone, receipt):
                    confirmed = True
                    break
        row = db.scalars(select(Transfer).where(Transfer.point_id == pt.id, Transfer.to_user_id == to_user.id)).first()
        if row is None:
            row = Transfer(point_id=pt.id, from_user_id=from_user.id, to_user_id=to_user.id, handover=e["handover"],
                           status="pending", payment_ref=str(e.get("payment_ref", ""))[:40],
                           transport=str(e.get("transport", ""))[:20], client_ts=str(e.get("ts", ""))[:40], source=role)
            db.add(row)
            db.flush()
        if receipt and not row.receipt:
            row.receipt = e["receipt"]
        res["transfer_id"] = row.id
        if row.status in ("paid", "held"):
            return {**res, "status": row.status, "reason": row.reason or "already_recorded"}
        if not confirmed:
            return {**res, "status": "pending", "reason": "waiting_for_receiver"}
        return {**res, **self._settle(db, pt, row, owner, to_user)}

    def _settle(self, db, pt: Point, row: Transfer, owner: User, to_user: User) -> dict:
        first = db.scalars(select(Transfer).where(Transfer.point_id == pt.id, Transfer.status == "paid")).first()
        if first is not None:
            return self._hold(db, pt, row, owner, to_user, "already_paid_to_someone_else")
        overflow = to_user.receive_bucket + 1 > self.s.receive_limit  # full bucket: the claim keeps its place and is paid to the main account
        try:
            with db.begin_nested():
                row.status, row.settled_at, row.reason = "paid", now(), "first_report"
                db.flush()  # the partial unique index decides a race here
        except IntegrityError:
            row.status = "pending"
            return self._hold(db, pt, row, owner, to_user, "already_paid_to_someone_else")
        if pt.status == "cancelled":
            # lost-phone wallet: no refund to the owner, but a real claim is still paid from what the bank kept
            self.move(db, "claim_paid_lost", to_user, ref=pt.pid, pool=-1, **({"main": 1} if overflow else {"recv": 1}), other=owner)
            db.add(ReviewItem(type="LOST_PHONE_CLAIM", user_id=owner.id,
                              summary=f"A valid claim arrived on point {pt.pid[:6]}... from a wallet reported lost: the report may have been false."))
            self.event(db, "lost_phone_claim", "MEDIUM", owner.id, pt.pid, "claim on a wallet the owner reported lost")
        else:
            # one entry, two users: the owner's send point is spent and the receiver's bucket grows
            if owner.send_bucket < 1:
                raise Rejected("owner_bucket_empty")
            owner.send_bucket -= 1
            if overflow:
                to_user.main_balance += 1
                db.add(LedgerEntry(kind="claim_paid_main", user_id=owner.id, other_user_id=to_user.id, ref=pt.pid, d_send=-1, d_main=1))
            else:
                to_user.receive_bucket += 1
                db.add(LedgerEntry(kind="claim_paid", user_id=owner.id, other_user_id=to_user.id, ref=pt.pid, d_send=-1, d_recv=1))
        pt.status = "spent"
        return {"status": "paid", "reason": "first_report"}

    def _hold(self, db, pt, row, owner, to_user, reason) -> dict:
        row.status, row.reason, row.settled_at = "held", reason, now()
        if not db.scalar(select(Notice.id).where(Notice.pid == pt.pid)):
            db.add(Notice(pid=pt.pid, reason="same ID claimed twice"))
        n_claims = db.scalar(select(func.count()).select_from(Transfer).where(Transfer.point_id == pt.id))
        self.event(db, "same_id", "HIGH", owner.id, pt.pid,
                   f"point claimed by {n_claims} people; first report paid, later claims held, traced to owner's device")
        if n_claims >= self.s.simultaneous_alert:
            self.event(db, "simultaneous_claims", "CRITICAL", owner.id, pt.pid, f"{n_claims} claimants on one point")
        if not owner.offline_suspended:
            owner.offline_suspended, owner.suspend_reason = True, "same point signed over to two people (automatic rule)"
            db.add(ReviewItem(type="SAME_ID", user_id=owner.id,
                              summary=f"Owner signed point {pt.pid[:6]}... over to {n_claims} people; offline use blocked automatically."))
        return {"status": "held", "reason": reason}

    # ---------- phone wallet snapshot audit (mines, restore, foreign IDs) ----------
    def note_counter(self, db, device: Device, snap: dict):
        kind = str(snap.get("counter_kind", "none"))
        self.put_setting(db, f"counter:{device.id}", kind if kind in ("hardware", "simulated-browser") else "none")

    def check_seq(self, db, user: User, device: Device, seq) -> list:
        """The sequence number is phone-supplied, so the bank keeps its own highest value per device: going backwards means a restored copy."""
        if not isinstance(seq, int):
            return []
        key = f"seq:{device.id}"
        last = int(self.get_setting(db, key, "-1"))
        if seq < last:
            self.event(db, "restore", "HIGH", user.id, "", f"wallet sequence {seq} is behind the bank's own record {last} for this device")
            return ["restore"]
        self.put_setting(db, key, str(seq))
        return []

    def check_build(self, db, user: User, digest: str) -> str:
        """Per official build: the operator registers the digests of official builds. Missing or unknown digests are logged, never silently skipped."""
        official = [d for d in (self.get_setting(db, "official_build_digest", "") or "").split(",") if d]
        if not official:
            return "no_official_build_registered"
        if not digest:
            self.event(db, "code_check", "MEDIUM", user.id, "", "sync arrived without a code digest although official builds are registered")
            return "missing"
        if digest not in official:
            self.event(db, "code_check", "HIGH", user.id, "", "code digest does not match any official build")
            return "mismatch"
        return "match"

    def audit_wallet(self, db, user: User, device: Device, snap: dict) -> list:
        out = []
        month = self.current_month(db)
        pids = [str(p) for p in snap.get("points", [])]
        mine_pids = set(pids)
        mine = [tuple(m) for m in snap.get("mines", [])]
        if pids:
            known = {p.pid for p in db.scalars(select(Point).where(Point.device_id == device.id, Point.pid.in_(pids)))}
            foreign = [p for p in pids if p not in known]
            if foreign:
                out.append("forged")
                self.event(db, "forged", "CRITICAL", user.id, foreign[0], f"{len(foreign)} IDs in the wallet were never issued to this device")
        out += self.check_seq(db, user, device, snap.get("seq"))
        if snap.get("seq") is not None and snap.get("counter") is not None and snap["seq"] != snap["counter"]:
            out.append("restore")
            self.event(db, "restore", "HIGH", user.id, "", "wallet sequence behind the hardware counter: wallet was restored from a copy")
        if pids and snap.get("month") == month:
            rec = mine_recipe(self.bank.seed, month)
            try:
                w = Wallet(rec, [p for p in pids], snap.get("control") or pids[0], HardwareCounter())
                w.mines = [m for m in mine if len(m) == 3 and all(isinstance(x, str) and len(x) == 20 for x in m)]
                a = audit_mines(w)
                if a["problems"] and len(pids) >= 9:
                    out.extend(a["problems"])
                    self.event(db, "landmine", "HIGH", user.id, "", f"mine audit: {', '.join(a['problems'])}")
            except (KeyError, IndexError, TypeError):
                out.append("mine_does_not_fit")
                self.event(db, "landmine", "HIGH", user.id, "", "mine audit failed: malformed mines")
        return out

    @staticmethod
    def review_hours(trust: int) -> int:
        """Held claims are looked at sooner when the claimant's trust is higher: 72 h at 300 down to 12 h at 850. Shown to reviewers; nothing is released automatically (the first report was already paid)."""
        return round(72 - 60 * (max(300, min(850, trust)) - 300) / 550)

    # ---------- sudden change (review only, never freezes anything) ----------
    def sudden_change(self, db, user: User, paid_now: int) -> bool:
        since = now() - timedelta(days=30)
        before = db.scalar(select(func.count()).select_from(Transfer).where(
            Transfer.status == "paid", Transfer.settled_at >= since, Transfer.settled_at < now() - timedelta(seconds=5),
            (Transfer.from_user_id == user.id) | (Transfer.to_user_id == user.id))) or 0
        typical_per_day = before / 30
        if paid_now >= self.s.sudden_change_min and paid_now >= 5 * (typical_per_day + 1):
            db.add(ReviewItem(type="SUDDEN_CHANGE", user_id=user.id,
                              summary=f"{paid_now} points settled in one sync against about {typical_per_day:.1f} a day before. Review only: nothing is frozen and the money has moved."))
            self.event(db, "sudden_change", "LOW", user.id, "", f"{paid_now} points settled in one sync (review item opened, no restriction)")
            return True
        return False

    # ---------- trust ----------
    def trust(self, db, user: User) -> tuple:
        since = max(now() - timedelta(days=183), user.trust_reset_at)
        age = max(0, (now() - user.trust_reset_at).days)
        paid = db.scalar(select(func.count()).select_from(Transfer).where(
            Transfer.status == "paid", Transfer.settled_at >= since, (Transfer.from_user_id == user.id) | (Transfer.to_user_id == user.id)))
        bad = db.scalar(select(func.count()).select_from(SecurityEvent).where(
            SecurityEvent.user_id == user.id, SecurityEvent.created_at >= since, SecurityEvent.type.notin_(("lost_phone_claim", "cross_check_fail", "cross_report_rejected", "sudden_change", "wallet_omitted", "topup_unsynced_spend", "code_check"))))
        held = db.scalar(select(func.count()).select_from(Transfer).where(
            Transfer.status == "held", Transfer.from_user_id == user.id, Transfer.settled_at >= since))
        score = 500 + min(120, age * 120 // 180) + min(100, paid * 5) - min(300, bad * 60) - min(200, held * 200)
        return max(300, min(850, score)), age

    CERT_DAYS = 40

    def trust_doc(self, db, user: User, device: Device | None = None) -> dict:
        """The signed certificate a phone shows to another phone: trust, limits, expiry, bound to the device key."""
        score, age = self.trust(db, user)
        extra = {"ls": self.s.send_limit, "lr": self.s.receive_limit, "x": int((now() + timedelta(days=self.CERT_DAYS)).timestamp())}
        if device is not None:
            extra["d"] = device.public_key
        blob, sig = sign_trust(self.bank, user.phone, score, age, self.current_month(db), extra)
        return {"score": score, "age_days": age, "window_days": 183, "blob": b64(blob), "sig": b64(sig)}

    # ---------- cross-reports (phone checks phone) ----------
    @staticmethod
    def cross_text(r: dict, reporter_phone: str) -> str:
        return "xr1|" + "|".join([reporter_phone, str(r.get("subject", "")), str(r.get("subject_pk", "")), str(r.get("ts", "")), str(r.get("result", "")),
                                  ",".join(r.get("codes", [])), str(r.get("nonce", "")), str(r.get("ri", ""))])

    def ingest_cross_reports(self, db, user: User, device: Device, reports: list, wallet_problems: list) -> dict:
        """Evidence only: stored, logged, queued for human review. Nothing here suspends or blocks anyone.
        A report from a reporter whose own integrity check fails is refused and logged against the reporter."""
        out = {"accepted": 0, "rejected": 0, "duplicate": 0}
        for r in reports[:100]:
            if not isinstance(r, dict):
                continue
            sig = str(r.get("sig", ""))
            if not sig or db.scalars(select(CrossReport).where(CrossReport.sig == sig)).first():
                out["duplicate"] += 1
                continue
            why = ""
            try:
                VerifyKey(unb64(device.public_key)).verify(self.cross_text(r, user.phone).encode(), unb64(sig))
            except Exception:
                why = "bad_signature"
            if not why and (r.get("result") not in ("pass", "fail") or not isinstance(r.get("codes", []), list)):
                why = "malformed"
            if not why and str(r.get("subject", "")) == user.phone:
                why = "self_report"
            if not why and (str(r.get("ri", "")) != "1" or wallet_problems or not device.active):
                why = "reporter_integrity_failed"
            if why:
                out["rejected"] += 1
                self.event(db, "cross_report_rejected", "MEDIUM", user.id, "", f"cross-report refused ({why}) about {str(r.get('subject', ''))[:15]}", source="phone")
                continue
            subj = db.scalars(select(User).where(User.phone == str(r["subject"]))).first()
            codes = ",".join(str(c)[:20] for c in r.get("codes", []))[:200]
            db.add(CrossReport(reporter_id=user.id, subject_phone=str(r["subject"])[:20], subject_id=subj.id if subj else None, result=r["result"], codes=codes,
                               ts=int(r.get("ts", 0) or 0), nonce=str(r.get("nonce", ""))[:40], sig=sig))
            if r["result"] == "fail":
                self.event(db, "cross_check_fail", "MEDIUM", subj.id if subj else None, "", f"{user.phone} reports failed mutual check [{codes}] at connection (log only)", source="phone")
                if subj:
                    db.add(ReviewItem(type="PEER_REPORT", user_id=subj.id, summary=f"mutual check failed [{codes}], reported by {user.phone}"))
            out["accepted"] += 1
        return out

    # ---------- flow map ----------
    def flow_map(self, db) -> dict:
        users = {u.id: u for u in db.scalars(select(User))}
        nodes = {"BANK": {"id": "BANK", "label": "Bank (issues + settles)", "kind": "bank"}}
        for u in users.values():
            nodes[f"U{u.id}"] = {"id": f"U{u.id}", "label": u.name, "kind": "user", "region": u.region, "bank": u.bank}
        edges = []
        issued = db.execute(select(Point.owner_id, func.count()).where(Point.kind == "value").group_by(Point.owner_id)).all()
        for uid, n in issued:
            edges.append({"from": "BANK", "to": f"U{uid}", "count": n, "kind": "issued", "status": "issued"})
        agg = db.execute(select(Transfer.from_user_id, Transfer.to_user_id, Transfer.status, func.count()).group_by(
            Transfer.from_user_id, Transfer.to_user_id, Transfer.status)).all()
        for f, t, st, n in agg:
            edges.append({"from": f"U{f}", "to": f"U{t}", "count": n, "kind": "transfer", "status": st})
        moved = db.execute(select(LedgerEntry.user_id, func.sum(-LedgerEntry.d_recv)).where(LedgerEntry.kind == "move_to_main").group_by(LedgerEntry.user_id)).all()
        for uid, n in moved:
            edges.append({"from": f"U{uid}", "to": "BANK", "count": int(n), "kind": "returned", "status": "paid"})
        not_returned = db.scalar(select(func.count()).select_from(Point).where(Point.kind == "value", Point.status == "issued"))
        recv_not_moved = db.scalar(select(func.coalesce(func.sum(User.receive_bucket), 0)))
        # region x day blackout view: payments that reached the bank late (client time vs server time)
        by_region = {}
        for t in db.scalars(select(Transfer)):
            u = users.get(t.from_user_id)
            key = (u.region if u else "?", t.created_at.strftime("%Y-%m-%d"))
            b = by_region.setdefault(key, {"region": key[0], "date": key[1], "transfers": 0, "held": 0, "pending": 0})
            b["transfers"] += 1
            b["held"] += t.status == "held"
            b["pending"] += t.status == "pending"
        recv_from = {}
        for f, t, st, n in agg:
            if st != "held":
                recv_from.setdefault(t, set()).add(f)
        clusters = [{"user": users[t].name, "distinct_senders": len(s)} for t, s in recv_from.items() if len(s) >= 3]
        return {"nodes": list(nodes.values()), "edges": edges, "ids_not_returned": not_returned,
                "received_not_moved_to_main": int(recv_not_moved), "blackout": list(by_region.values()),
                "suspicious_clusters": clusters,
                "note": "Flags here go to the review queue only. Nothing is frozen by the map."}
