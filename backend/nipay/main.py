"""NiPay API. Fake money and test data only. See README for what is real and what is simulated."""
import json
import re
from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from .config import ADMIN_USERS, Settings, load_secrets
from .core.idsystem import verify_sig
from .core.wallet import code_digest, choose_block
from .db import Base, make_engine, make_session_factory
from .models import (Appeal, AuditLog, CrossReport, Device, LedgerEntry, Notice, Point, Report, ReviewItem, SecurityEvent,
                     SettlementBatch, Session, Setting, Transfer, User, now)
from .security import PinGuard, RateLimiter, check_pin, hash_pin, hash_token, new_token
from .service import Rejected, Svc, b64, unb64

PHONE_RE = re.compile(r"^\+?[0-9]{10,13}$")
TRIPWIRES = {"forged", "landmine", "tower", "code_check", "restore", "control_key_leak", "root"}
BANKS = ("Demo Bank A", "Demo Bank B", "Demo Bank C")  # fictional; no real bank names or logos


# ---------- request bodies ----------
class Kyc(BaseModel):
    test_aadhaar: str = ""   # accepted as test data, never stored
    test_pan: str = ""       # accepted as test data, never stored
    address: str = ""


class RegisterIn(BaseModel):
    phone: str
    otp: str
    name: str = Field(min_length=1, max_length=80)
    pin: str
    kyc: Kyc = Kyc()
    device_public_key: str
    device_label: str = "web phone"
    region: str = "Plains"
    bank: str = BANKS[0]
    language: str = "en"
    accepted_terms: bool = False
    no_account_renting: bool = False


class LoginIn(BaseModel):
    phone: str
    pin: str
    device_public_key: str
    device_label: str = "web phone"


class CancelIn(LoginIn):
    reason: str = Field(min_length=3, max_length=500)
    balance_summary: str = ""


class TopupIn(BaseModel):
    amount: int
    pin: str


class MoveIn(BaseModel):
    amount: int


class SyncIn(BaseModel):
    logs: list[dict] = []
    reports: list[dict] = []
    wallet: dict | None = None
    cross_reports: list[dict] = []
    client_time: str = ""


class ClaimsIn(BaseModel):
    claims: list[dict]


class ReportIn(BaseModel):
    kind: str
    detail: str = ""
    pid: str = ""


class AppealIn(BaseModel):
    reason: str = Field(min_length=3)
    kind: str = "flag"
    documents: list[str] = []


class IntegrityIn(BaseModel):
    code_digest: str = ""
    block: list[int] = []
    play_integrity_token: str = ""
    app_attest: str = ""


class AdminLoginIn(BaseModel):
    username: str
    password: str


class DecideIn(BaseModel):
    decision: str
    note: str = ""


class SuspendIn(BaseModel):
    suspended: bool
    reason: str = Field(min_length=3)


def create_app(settings: Settings | None = None, portal: str = "all") -> FastAPI:
    """portal 'user' serves only the phone API, 'admin' only /admin/*. 'all' (tests) serves both. Two separate servers in production."""
    st = settings or Settings()
    store = load_secrets(st.data_dir)
    svc = Svc(st, store)
    engine = make_engine(st.database_url)
    Base.metadata.create_all(engine)
    SessionLocal = make_session_factory(engine)
    limiter, pin_guard = RateLimiter(), PinGuard()
    admin_roles = dict(ADMIN_USERS)

    app = FastAPI(title="NiPay demo API", version="0.2")
    app.state.svc, app.state.SessionLocal, app.state.settings = svc, SessionLocal, st
    app.add_middleware(CORSMiddleware, allow_origins=list(st.admin_cors_origins if portal == "admin" else st.cors_origins), allow_credentials=False,
                       allow_methods=["*"], allow_headers=["*"])

    @app.middleware("http")
    async def rate_limit(request: Request, call_next):
        ip = request.client.host if request.client else "?"
        path = request.url.path
        if request.method != "OPTIONS":
            limit = st.login_rate_per_min if path in ("/auth/login", "/auth/register", "/admin/login", "/auth/cancel-device") else st.rate_limit_per_min
            if not limiter.allow((ip, "auth" if limit == st.login_rate_per_min else "all"), limit):
                return JSONResponse({"detail": "rate_limited"}, status_code=429, headers={"Retry-After": "60"})
        return await call_next(request)

    def get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()  # anything not committed is rolled back

    def _session(db, authorization: str | None) -> Session:
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(401, "missing_token")
        s = db.scalars(select(Session).where(Session.token_hash == hash_token(authorization[7:].strip()))).first()
        if s is None or not s.active or s.expires_at < now():
            raise HTTPException(401, "bad_token")
        return s

    class Ctx:
        def __init__(self, db, user, device, session):
            self.db, self.user, self.device, self.session = db, user, device, session

    def user_ctx(authorization: str | None = Header(None), db=Depends(get_db)) -> Ctx:
        s = _session(db, authorization)
        if s.user_id is None:
            raise HTTPException(403, "not_a_user_token")
        dev = db.get(Device, s.device_id)
        if not dev.active:
            raise HTTPException(401, "device_cancelled")
        return Ctx(db, db.get(User, s.user_id), dev, s)

    def admin_ctx(authorization: str | None = Header(None), db=Depends(get_db)) -> Ctx:
        s = _session(db, authorization)
        if s.admin_name is None:
            raise HTTPException(403, "not_admin")
        return Ctx(db, None, None, s)

    def can_decide(ctx):
        if ctx.session.admin_role not in ("SUPER_ADMIN", "FRAUD_INVESTIGATOR"):
            raise HTTPException(403, "role_cannot_decide")

    def ip_of(request: Request) -> str:
        return request.client.host if request.client else ""

    def bad(code, status=400):
        raise HTTPException(status, code)

    def wallet_view(db, u: User, dev: Device | None = None) -> dict:
        cur = svc.current_month(db)
        pending = db.scalar(select(func.count()).select_from(Transfer).where(Transfer.status == "pending", (Transfer.from_user_id == u.id) | (Transfer.to_user_id == u.id)))
        rot = svc.rotated_at(db)
        nxt = (rot.replace(day=28) + timedelta(days=5)).replace(day=1)
        return {"id": u.id, "name": u.name, "phone": u.phone, "bank": u.bank, "region": u.region, "language": u.language,
                "kyc_status": u.kyc_status, "kyc_note": "test data only; no real Aadhaar/PAN is stored",
                "main_balance": u.main_balance, "send_bucket": u.send_bucket, "receive_bucket": u.receive_bucket,
                "send_limit": st.send_limit, "receive_limit": st.receive_limit, "offline_suspended": u.offline_suspended,
                "suspend_reason": u.suspend_reason, "month": cur, "days_until_renewal": max(0, (nxt - datetime.now(timezone.utc)).days),
                "grace_days": st.grace_days, "pending_transfers": pending,
                "last_sync_at": u.last_sync_at.isoformat() if u.last_sync_at else None,
                "device": {"id": dev.id, "label": dev.label} if dev else None}

    def open_session(db, user, dev, hours=12) -> str:
        tok, h = new_token()
        db.add(Session(token_hash=h, user_id=user.id, device_id=dev.id, expires_at=now() + timedelta(hours=hours)))
        return tok

    # ---------- public ----------
    @app.get("/health")
    def health():
        return {"ok": True}

    @app.get("/bank/public-key")
    def public_key():
        """A public key is public by nature; phones carry it."""
        return {"public_key": svc.pub_b64, "algorithm": "Ed25519"}

    # ---------- auth ----------
    @app.post("/auth/register")
    def register(body: RegisterIn, request: Request, db=Depends(get_db)):
        if not PHONE_RE.match(body.phone):
            bad("bad_phone")
        if body.otp != st.otp:
            bad("bad_otp", 403)  # MOCK OTP: the demo code is fixed, no SMS exists
        if not re.fullmatch(r"[0-9]{4,6}", body.pin):
            bad("pin_must_be_4_to_6_digits")
        if not (body.accepted_terms and body.no_account_renting):
            bad("terms_required")
        if len(unb64(body.device_public_key)) != 32:
            bad("bad_device_key")
        if body.bank not in BANKS:
            bad("unknown_bank")
        if db.scalars(select(User).where(User.phone == body.phone)).first():
            bad("phone_already_registered", 409)
        # test KYC values are checked for shape only and then dropped
        u = User(phone=body.phone, name=body.name.strip(), pin_hash=hash_pin(body.pin), bank=body.bank,
                 region=body.region[:40], language="hi" if body.language == "hi" else "en",
                 address_city=body.kyc.address[:60])
        db.add(u)
        db.flush()
        dev = Device(user_id=u.id, public_key=body.device_public_key, label=body.device_label[:80])
        db.add(dev)
        db.flush()
        svc.grant_test_funds(db, u)
        tok = open_session(db, u, dev)
        db.commit()
        return {"token": tok, "wallet": wallet_view(db, u, dev), "bank_public_key": svc.pub_b64}

    def _check_creds(db, phone, pin) -> User:
        if pin_guard.locked(phone):
            bad("too_many_wrong_pins", 429)
        u = db.scalars(select(User).where(User.phone == phone)).first()
        if u is None or not check_pin(pin, u.pin_hash):
            pin_guard.fail(phone)
            bad("bad_credentials", 401)
        pin_guard.ok(phone)
        return u

    def _device_for(db, u, public_key, label):
        if len(unb64(public_key)) != 32:
            bad("bad_device_key")
        dev = db.scalars(select(Device).where(Device.user_id == u.id, Device.public_key == public_key)).first()
        return dev, label

    @app.post("/auth/login")
    def login(body: LoginIn, db=Depends(get_db)):
        u = _check_creds(db, body.phone, body.pin)
        dev, _ = _device_for(db, u, body.device_public_key, body.device_label)
        if dev is not None and not dev.active:
            bad("this_device_was_cancelled", 403)
        active = db.scalars(select(Device).where(Device.user_id == u.id, Device.active == True)).all()  # noqa: E712
        if dev is None:
            if active:
                # one login at a time: another device is live, so the user must file a cancellation report
                raise HTTPException(409, {"code": "already_active_elsewhere", "device_label": active[0].label,
                                          "since": active[0].created_at.isoformat(), "send_bucket": u.send_bucket,
                                          "receive_bucket": u.receive_bucket, "main_balance": u.main_balance})
            dev = Device(user_id=u.id, public_key=body.device_public_key, label=body.device_label[:80])
            db.add(dev)
            db.flush()
            u.trust_reset_at = now()  # a new device resets trust
        elif any(d.id != dev.id for d in active):
            raise HTTPException(409, {"code": "already_active_elsewhere", "device_label": active[0].label})
        tok = open_session(db, u, dev)
        db.commit()
        return {"token": tok, "wallet": wallet_view(db, u, dev), "bank_public_key": svc.pub_b64}

    @app.post("/auth/cancel-device")
    def cancel_device(body: CancelIn, db=Depends(get_db)):
        u = _check_creds(db, body.phone, body.pin)
        dev, _ = _device_for(db, u, body.device_public_key, body.device_label)
        if dev is not None and not dev.active:
            bad("this_device_was_cancelled", 403)
        if dev is None:
            dev = Device(user_id=u.id, public_key=body.device_public_key, label=body.device_label[:80])
            db.add(dev)
            db.flush()
        forfeited = svc.cancel_other_devices(db, u, body.reason, keep_device_id=dev.id)
        for s in db.scalars(select(Session).where(Session.user_id == u.id, Session.device_id != dev.id, Session.active == True)):  # noqa: E712
            s.active = False
        u.trust_reset_at = now()
        db.add(Report(user_id=u.id, kind="cancel_device", detail=json.dumps({"reason": body.reason, "summary": body.balance_summary, "forfeited": forfeited})))
        tok = open_session(db, u, dev)
        db.commit()
        return {"token": tok, "forfeited_points": forfeited, "refund": 0,
                "note": "Old device cancelled. Lost-phone rule: unspent points are not refunded; valid claims on them are still paid.",
                "wallet": wallet_view(db, u, dev), "bank_public_key": svc.pub_b64}

    @app.post("/auth/logout")
    def logout(ctx: Ctx = Depends(user_ctx)):
        ctx.session.active = False
        ctx.db.commit()
        return {"ok": True}

    # ---------- wallet ----------
    @app.get("/wallet")
    def get_wallet(ctx: Ctx = Depends(user_ctx)):
        return wallet_view(ctx.db, ctx.user, ctx.device)

    @app.post("/wallet/topup")
    def topup(body: TopupIn, ctx: Ctx = Depends(user_ctx)):
        if not check_pin(body.pin, ctx.user.pin_hash):
            bad("bad_pin", 403)
        try:
            pts = svc.topup(ctx.db, ctx.user, ctx.device, body.amount)
        except Rejected as r:
            ctx.db.rollback()
            bad(r.code)
        ctx.db.commit()
        return {"points": pts, "fee": 1, "wallet": wallet_view(ctx.db, ctx.user, ctx.device)}

    @app.post("/wallet/move-to-main")
    def move_to_main(body: MoveIn, ctx: Ctx = Depends(user_ctx)):
        try:
            svc.move_to_main(ctx.db, ctx.user, body.amount)
        except Rejected as r:
            ctx.db.rollback()
            bad(r.code)
        ctx.db.commit()
        return wallet_view(ctx.db, ctx.user, ctx.device)

    # ---------- sync and claims ----------
    def run_logs(ctx: Ctx, logs: list) -> list:
        out = []
        for e in logs[:500]:
            role = "claimant" if e.get("role") in ("received", "claimant") else "sender"
            try:
                out.append(svc.process_transfer(ctx.db, ctx.user, role, e))
            except Rejected as r:
                out.append({"pid": e.get("pid", ""), "status": "rejected", "reason": r.code})
        return out

    @app.post("/sync")
    def sync(body: SyncIn, ctx: Ctx = Depends(user_ctx)):
        db, u = ctx.db, ctx.user
        results = run_logs(ctx, body.logs)
        for r in body.reports[:50]:
            t = str(r.get("type", ""))
            if t in TRIPWIRES:
                svc.event(db, t, "MEDIUM", u.id, str(r.get("pid", ""))[:20], str(r.get("description", ""))[:300], source="phone")
        problems = svc.audit_wallet(db, u, ctx.device, body.wallet) if body.wallet else []
        cross = svc.ingest_cross_reports(db, u, ctx.device, body.cross_reports, problems)
        u.last_sync_at = now()
        db.add(Report(user_id=u.id, kind="sync", detail=json.dumps({"logs": len(body.logs), "reports": len(body.reports), "problems": problems})))
        db.commit()
        cur = svc.current_month(db)
        return {"results": results, "wallet_audit": problems, "server_time": now().isoformat(),
                "wallet": wallet_view(db, u, ctx.device), "rules": svc.rules_doc(db, cur), "notices": svc.notices_doc(db),
                "trust": svc.trust_doc(db, u, ctx.device), "cross_reports": cross}

    @app.post("/claims")
    def claims(body: ClaimsIn, ctx: Ctx = Depends(user_ctx)):
        res = []
        for e in body.claims[:500]:
            try:
                res.append(svc.process_transfer(ctx.db, ctx.user, "claimant", e))
            except Rejected as r:
                res.append({"pid": e.get("pid", ""), "status": "rejected", "reason": r.code})
        ctx.db.commit()
        return {"results": res, "wallet": wallet_view(ctx.db, ctx.user, ctx.device)}

    @app.get("/history")
    def history(ctx: Ctx = Depends(user_ctx)):
        db, u = ctx.db, ctx.user
        rows = db.scalars(select(Transfer).where((Transfer.from_user_id == u.id) | (Transfer.to_user_id == u.id)).order_by(Transfer.id.desc()).limit(300)).all()
        names = {x.id: x for x in db.scalars(select(User).where(User.id.in_({r.from_user_id for r in rows} | {r.to_user_id for r in rows} | {0})))}
        groups = {}
        for r in rows:
            other = names[r.to_user_id if r.from_user_id == u.id else r.from_user_id]
            key = (r.payment_ref or f"t{r.id}", "sent" if r.from_user_id == u.id else "received")
            g = groups.setdefault(key, {"id": key[0], "direction": key[1], "counterparty": other.name, "phone": other.phone,
                                        "amount": 0, "statuses": set(), "when": r.created_at.isoformat(), "transport": r.transport})
            g["amount"] += 1
            g["statuses"].add(r.status)
        out = []
        for g in groups.values():
            s = g.pop("statuses")
            g["status"] = "held" if "held" in s else "pending" if "pending" in s else "paid"
            out.append(g)
        return {"payments": out}

    # ---------- signed documents ----------
    @app.get("/rules/current")
    def rules_current(ctx: Ctx = Depends(user_ctx)):
        cur = svc.current_month(ctx.db)
        prev = svc.prev_month(cur)
        return {"current": svc.rules_doc(ctx.db, cur),
                "previous": svc.rules_doc(ctx.db, prev) if svc.month_valid(ctx.db, prev) else None,
                "bank_public_key": svc.pub_b64, "server_time": now().isoformat()}

    @app.get("/notices")
    def notices(ctx: Ctx = Depends(user_ctx)):
        return svc.notices_doc(ctx.db)

    @app.get("/trust/certificate")
    def trust_cert(ctx: Ctx = Depends(user_ctx)):
        return svc.trust_doc(ctx.db, ctx.user, ctx.device)

    @app.post("/integrity/verify")
    def integrity(body: IntegrityIn, ctx: Ctx = Depends(user_ctx)):
        """Code-block check is real (needs an official build digest registered by the operator).
        Play Integrity and App Attest are not implemented in this web demo."""
        cur = svc.current_month(ctx.db)
        out = {"play_integrity": "not_implemented_in_web_demo", "app_attest": "not_implemented_in_web_demo",
               "month": cur, "block": list(choose_block(svc.bank.seed, cur, 100000))}
        official = ctx.db.get(Setting, "official_build_digest")
        if body.code_digest and official is None:
            out["code_check"] = "no_official_build_registered"
        elif body.code_digest:
            ok = body.code_digest == official.value
            out["code_check"] = "match" if ok else "mismatch"
            if not ok:
                svc.event(ctx.db, "code_check", "HIGH", ctx.user.id, "", "code block digest does not match the official build")
                ctx.db.commit()
        return out

    # ---------- reports and appeals ----------
    @app.post("/reports")
    def report(body: ReportIn, ctx: Ctx = Depends(user_ctx)):
        db, u = ctx.db, ctx.user
        if body.kind == "lost_phone":
            n = svc.cancel_other_devices(db, u, "lost phone report: " + body.detail, keep_device_id=None)
            for s in db.scalars(select(Session).where(Session.user_id == u.id, Session.active == True)):  # noqa: E712
                s.active = False
            db.add(Report(user_id=u.id, kind="lost_phone", detail=body.detail[:500]))
            db.commit()
            return {"forfeited_points": n, "refund": 0, "note": "Lost-phone rule: no refund. The bank keeps what is left; valid claims on it are still paid."}
        if body.kind in TRIPWIRES:
            svc.event(db, body.kind, "MEDIUM", u.id, body.pid[:20], body.detail[:300], source="phone")
        elif body.kind == "payment_problem":
            db.add(ReviewItem(type="PEER_REPORT", user_id=u.id, summary=body.detail[:500] or "payment problem reported"))
        else:
            bad("unknown_report_kind")
        db.add(Report(user_id=u.id, kind=body.kind, detail=body.detail[:500]))
        db.commit()
        return {"ok": True}

    @app.post("/appeals")
    def appeal(body: AppealIn, ctx: Ctx = Depends(user_ctx)):
        a = Appeal(user_id=ctx.user.id, kind=body.kind[:20], reason=body.reason[:2000], documents=body.documents[:5],
                   deadline=now() + timedelta(hours=48))
        ctx.db.add(a)
        ctx.db.commit()
        return {"id": a.id, "status": a.status, "deadline": a.deadline.isoformat()}

    @app.get("/appeals/mine")
    def my_appeals(ctx: Ctx = Depends(user_ctx)):
        rows = ctx.db.scalars(select(Appeal).where(Appeal.user_id == ctx.user.id).order_by(Appeal.id.desc())).all()
        return {"appeals": [{"id": a.id, "reason": a.reason, "status": a.status, "deadline": a.deadline.isoformat()} for a in rows]}

    # ---------- admin ----------
    @app.post("/admin/login")
    def admin_login(body: AdminLoginIn, request: Request, db=Depends(get_db)):
        import hmac as _h
        ok = body.username in admin_roles and _h.compare_digest(body.password, store["admins"][body.username])
        if not ok:
            bad("bad_credentials", 401)
        tok, h = new_token()
        db.add(Session(token_hash=h, admin_name=body.username, admin_role=admin_roles[body.username], expires_at=now() + timedelta(hours=8)))
        svc.audit(db, body.username, admin_roles[body.username], "ADMIN_LOGIN", "", ip_of(request))
        db.commit()
        return {"token": tok, "name": body.username, "role": admin_roles[body.username]}

    def iso(d):
        return d.isoformat() if d else None

    @app.get("/admin/overview")
    def a_overview(ctx: Ctx = Depends(admin_ctx)):
        db = ctx.db
        t = svc.ledger_totals(db)
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        c = lambda q: db.scalar(q)
        return {"money_in_slots": {"main": t["main"], "send_bucket": t["send"], "receive_bucket": t["recv"], "bank_kept": t["pool"], "fees": t["fees"]},
                "payments_today": c(select(func.count()).select_from(Transfer).where(Transfer.created_at >= today)),
                "pending_sync": c(select(func.count()).select_from(Transfer).where(Transfer.status == "pending")),
                "held_claims": c(select(func.count()).select_from(Transfer).where(Transfer.status == "held")),
                "active_alerts": c(select(func.count()).select_from(SecurityEvent).where(SecurityEvent.created_at >= now() - timedelta(days=1))),
                "users": c(select(func.count()).select_from(User)),
                "health": {"database": "ok", "audit_chain_intact": svc.audit_chain_ok(db),
                           "ledger_balanced": t["main"] + t["send"] + t["recv"] + t["pool"] + t["fees"] + t["mint"] == 0},
                "month": svc.current_month(db)}

    @app.get("/admin/live")
    def a_live(ctx: Ctx = Depends(admin_ctx)):
        db = ctx.db
        names = {u.id: u.name for u in db.scalars(select(User))}
        ev = []
        for r in db.scalars(select(Report).where(Report.kind == "sync").order_by(Report.id.desc()).limit(60)):
            d = json.loads(r.detail)
            ev.append({"ts": iso(r.created_at), "type": "SYNC", "who": names.get(r.user_id), "text": f"{d['logs']} log lines, {d['reports']} reports, audit: {d['problems'] or 'clean'}"})
        for t in db.scalars(select(Transfer).order_by(Transfer.id.desc()).limit(60)):
            ev.append({"ts": iso(t.settled_at or t.created_at), "type": "PAYMENT_" + t.status.upper(), "who": names.get(t.from_user_id),
                       "text": f"{names.get(t.from_user_id)} to {names.get(t.to_user_id)}: 1 point ({t.reason or 'waiting'})"})
        ev.sort(key=lambda x: x["ts"] or "", reverse=True)
        return {"events": ev[:100]}

    @app.get("/admin/users")
    def a_users(q: str = "", ctx: Ctx = Depends(admin_ctx)):
        db = ctx.db
        out = []
        for u in db.scalars(select(User).order_by(User.id)):
            if q and q.lower() not in (u.name + u.phone).lower():
                continue
            score, _ = svc.trust(db, u)
            devs = db.scalars(select(Device).where(Device.user_id == u.id)).all()
            out.append({"id": u.id, "name": u.name, "phone": u.phone, "kyc_status": u.kyc_status, "bank": u.bank, "region": u.region,
                        "main_balance": u.main_balance, "send_bucket": u.send_bucket, "receive_bucket": u.receive_bucket, "trust": score,
                        "offline_suspended": u.offline_suspended, "suspend_reason": u.suspend_reason, "last_sync_at": iso(u.last_sync_at),
                        "devices": [{"label": d.label, "active": d.active, "cancel_reason": d.cancel_reason} for d in devs]})
        return {"users": out}

    @app.post("/admin/users/{uid}/suspend")
    def a_suspend(uid: int, body: SuspendIn, request: Request, ctx: Ctx = Depends(admin_ctx)):
        can_decide(ctx)
        u = ctx.db.get(User, uid)
        if u is None:
            bad("no_such_user", 404)
        u.offline_suspended, u.suspend_reason = body.suspended, body.reason if body.suspended else ""
        svc.audit(ctx.db, ctx.session.admin_name, ctx.session.admin_role, "SUSPEND_OFFLINE" if body.suspended else "RESTORE_OFFLINE", f"{u.phone}: {body.reason}", ip_of(request))
        ctx.db.commit()
        return {"ok": True}

    @app.get("/admin/security-logs")
    def a_seclogs(ctx: Ctx = Depends(admin_ctx)):
        """Read-only. There is deliberately no resolve or close endpoint for these."""
        db = ctx.db
        users = {u.id: u for u in db.scalars(select(User))}
        rows = db.scalars(select(SecurityEvent).order_by(SecurityEvent.id.desc()).limit(500)).all()
        return {"events": [{"id": e.id, "type": e.type, "severity": e.severity, "at": iso(e.created_at), "pid": e.pid, "description": e.description,
                            "source": e.source, "user": users[e.user_id].name if e.user_id in users else None,
                            "phone": users[e.user_id].phone if e.user_id in users else None, "region": users[e.user_id].region if e.user_id in users else None} for e in rows]}

    @app.get("/admin/same-id")
    def a_sameid(ctx: Ctx = Depends(admin_ctx)):
        db = ctx.db
        users = {u.id: u for u in db.scalars(select(User))}
        pids = db.scalars(select(Transfer.point_id).where(Transfer.status == "held").distinct()).all()
        out = []
        for pid in pids:
            p = db.get(Point, pid)
            rows = db.scalars(select(Transfer).where(Transfer.point_id == pid).order_by(Transfer.id)).all()
            dev = db.get(Device, p.device_id)
            out.append({"pid": p.pid, "month": p.month, "owner": users[p.owner_id].name, "owner_phone": users[p.owner_id].phone, "owner_device": dev.label,
                        "outcome": "automatic: first report paid, later claims held, traced to owner",
                        "claimants": [{"name": users[r.to_user_id].name, "phone": users[r.to_user_id].phone, "status": r.status, "reason": r.reason,
                                       "at": iso(r.settled_at or r.created_at), "trust": svc.trust(db, users[r.to_user_id])[0]} for r in rows]})
        return {"cases": out}

    @app.get("/admin/review")
    def a_review(ctx: Ctx = Depends(admin_ctx)):
        users = {u.id: u for u in ctx.db.scalars(select(User))}
        rows = ctx.db.scalars(select(ReviewItem).order_by(ReviewItem.id.desc())).all()
        return {"items": [{"id": r.id, "type": r.type, "user": users[r.user_id].name, "phone": users[r.user_id].phone, "summary": r.summary,
                           "status": r.status, "at": iso(r.created_at), "decided_by": r.decided_by} for r in rows]}

    @app.post("/admin/review/{rid}/decide")
    def a_review_decide(rid: int, body: DecideIn, request: Request, ctx: Ctx = Depends(admin_ctx)):
        can_decide(ctx)
        r = ctx.db.get(ReviewItem, rid)
        if r is None or body.decision not in ("CLEARED", "SUSPENDED"):
            bad("bad_request")
        r.status, r.decided_by = body.decision, ctx.session.admin_name
        u = ctx.db.get(User, r.user_id)
        if body.decision == "SUSPENDED":
            u.offline_suspended, u.suspend_reason = True, "review decision: " + body.note[:100]
        svc.audit(ctx.db, ctx.session.admin_name, ctx.session.admin_role, "REVIEW_" + body.decision, f"item {rid} user {u.phone}", ip_of(request))
        ctx.db.commit()
        return {"ok": True}

    @app.get("/admin/appeals")
    def a_appeals(ctx: Ctx = Depends(admin_ctx)):
        users = {u.id: u for u in ctx.db.scalars(select(User))}
        rows = ctx.db.scalars(select(Appeal).order_by(Appeal.id.desc())).all()
        return {"appeals": [{"id": a.id, "user": users[a.user_id].name, "phone": users[a.user_id].phone, "reason": a.reason, "documents": a.documents,
                             "status": a.status, "submitted_at": iso(a.created_at), "deadline": iso(a.deadline),
                             "hours_left": max(0, int((a.deadline - now()).total_seconds() // 3600))} for a in rows]}

    @app.post("/admin/appeals/{aid}/decide")
    def a_appeal_decide(aid: int, body: DecideIn, request: Request, ctx: Ctx = Depends(admin_ctx)):
        can_decide(ctx)
        a = ctx.db.get(Appeal, aid)
        if a is None or body.decision not in ("APPROVED", "REJECTED"):
            bad("bad_request")
        a.status, a.decided_by = body.decision, ctx.session.admin_name
        if body.decision == "APPROVED":
            u = ctx.db.get(User, a.user_id)
            u.offline_suspended, u.suspend_reason = False, ""
        svc.audit(ctx.db, ctx.session.admin_name, ctx.session.admin_role, "APPEAL_" + body.decision, f"appeal {aid}", ip_of(request))
        ctx.db.commit()
        return {"ok": True}

    @app.get("/admin/flow-map")
    def a_flow(ctx: Ctx = Depends(admin_ctx)):
        return svc.flow_map(ctx.db)

    @app.get("/admin/rules")
    def a_rules(ctx: Ctx = Depends(admin_ctx)):
        """Status only. Seed, signing key and recipe values are never shown."""
        db = ctx.db
        cur = svc.current_month(db)
        return {"month": cur, "previous_month": svc.prev_month(cur), "previous_in_grace": svc.month_valid(db, svc.prev_month(cur)),
                "grace_days": st.grace_days, "rotated_at": iso(svc.rotated_at(db)), "send_limit": st.send_limit, "receive_limit": st.receive_limit,
                "bad_id_notices": db.scalar(select(func.count()).select_from(Notice)), "bank_public_key": svc.pub_b64,
                "points_issued_this_month": db.scalar(select(func.count()).select_from(Point).where(Point.month == cur)),
                "secrets": "seed and signing key are held on the server only and are not displayed"}

    @app.post("/admin/rules/rotate")
    def a_rotate(request: Request, ctx: Ctx = Depends(admin_ctx)):
        if ctx.session.admin_role != "SUPER_ADMIN":
            bad("super_admin_only", 403)
        nxt = svc.rotate(ctx.db)
        svc.audit(ctx.db, ctx.session.admin_name, ctx.session.admin_role, "ROTATE_RULES", nxt, ip_of(request))
        ctx.db.commit()
        return {"month": nxt}

    @app.get("/admin/ledger")
    def a_ledger(ctx: Ctx = Depends(admin_ctx)):
        db = ctx.db
        users = {u.id: u for u in db.scalars(select(User))}
        batches = {b.id: b for b in db.scalars(select(SettlementBatch))}
        agg = {}
        for t in db.scalars(select(Transfer).where(Transfer.status == "paid")):
            a, b = users[t.from_user_id].bank, users[t.to_user_id].bank
            if a == b:
                continue
            k = (a, b, t.batch_id)
            agg[k] = agg.get(k, 0) + 1
        rows = [{"debtor_bank": a, "creditor_bank": b, "batch": f"B-{bid}" if bid else "next batch", "points": n, "rupees": n,
                 "status": batches[bid].status if bid else "OPEN"} for (a, b, bid), n in agg.items()]
        return {"entries": rows, "totals": svc.ledger_totals(db), "note": "Between banks only. Same-bank payments need no settlement."}

    @app.post("/admin/ledger/settle")
    def a_settle(request: Request, ctx: Ctx = Depends(admin_ctx)):
        if ctx.session.admin_role != "SUPER_ADMIN":
            bad("super_admin_only", 403)
        db = ctx.db
        b = SettlementBatch(status="SETTLED", settled_at=now())
        db.add(b)
        db.flush()
        n = 0
        for t in db.scalars(select(Transfer).where(Transfer.status == "paid", Transfer.batch_id.is_(None))):
            t.batch_id = b.id
            n += 1
        svc.audit(db, ctx.session.admin_name, ctx.session.admin_role, "SETTLE_BATCH", f"B-{b.id} ({n} transfers)", ip_of(request))
        db.commit()
        return {"batch": b.id, "transfers": n}

    @app.get("/admin/live-ledger")
    def a_live_ledger(a: str = "", b: str = "", ctx: Ctx = Depends(admin_ctx)):
        """Projector page data: test money only. Balances come straight from the server ledger,
        so they change only when a sync or top-up reaches the server, never during an offline payment."""
        db = ctx.db
        users = db.scalars(select(User).order_by(User.id)).all()
        pick = lambda ph, i: next((u for u in users if u.phone == ph), users[i] if len(users) > i else None)
        ua, ub = pick(a, 0), pick(b, 1)
        if ub is not None and ua is not None and ub.id == ua.id:
            ub = next((u for u in users if u.id != ua.id), None)
        view = lambda u: None if u is None else {"id": u.id, "name": u.name, "phone": u.phone, "account": u.main_balance, "send_slot": u.send_bucket, "receive_slot": u.receive_bucket}
        ids = [u.id for u in (ua, ub) if u]
        rows = db.scalars(select(LedgerEntry).where((LedgerEntry.user_id.in_(ids)) | (LedgerEntry.other_user_id.in_(ids))).order_by(LedgerEntry.id.desc()).limit(12)).all() if ids else []
        names = {u.id: u.name for u in users}
        return {"label": "TEST MONEY - fake rupees, no real payment gateway", "a": view(ua), "b": view(ub), "users": [{"phone": u.phone, "name": u.name} for u in users],
                "server_time": now().isoformat(), "last_entry_id": rows[0].id if rows else 0,
                "entries": [{"id": r.id, "at": r.ts.isoformat(), "kind": r.kind, "who": names.get(r.user_id), "other": names.get(r.other_user_id),
                             "d_main": r.d_main, "d_send": r.d_send, "d_recv": r.d_recv} for r in rows]}

    @app.get("/admin/analytics")
    def a_analytics(ctx: Ctx = Depends(admin_ctx)):
        db = ctx.db
        by_status = dict(db.execute(select(Transfer.status, func.count()).group_by(Transfer.status)).all())
        by_type = dict(db.execute(select(SecurityEvent.type, func.count()).group_by(SecurityEvent.type)).all())
        users = {u.id: u for u in db.scalars(select(User))}
        reg = {}
        delays = []
        for t in db.scalars(select(Transfer)):
            r = users[t.from_user_id].region
            reg[r] = reg.get(r, 0) + 1
            if t.settled_at and t.created_at:
                delays.append((t.settled_at - t.created_at).total_seconds())
        lost = db.scalar(select(func.coalesce(func.sum(LedgerEntry.d_pool), 0)))
        return {"transfers_by_status": by_status, "tripwires_by_type": by_type, "transfers_by_region": reg,
                "avg_settle_delay_seconds": round(sum(delays) / len(delays), 1) if delays else 0,
                "kept_by_bank_after_lost_phones": lost, "fees_collected": svc.ledger_totals(db)["fees"]}

    @app.get("/admin/audit-log")
    def a_audit(ctx: Ctx = Depends(admin_ctx)):
        rows = ctx.db.scalars(select(AuditLog).order_by(AuditLog.id.desc()).limit(300)).all()
        return {"chain_intact": svc.audit_chain_ok(ctx.db),
                "entries": [{"id": r.id, "at": iso(r.ts), "actor": r.actor, "role": r.role, "action": r.action, "target": r.target, "ip": r.ip} for r in rows]}

    @app.get("/admin/cross-reports")
    def a_cross(ctx: Ctx = Depends(admin_ctx)):
        """Read-only. Mutual-check results phones recorded on each other. Evidence for review; nobody is suspended by these."""
        db = ctx.db
        users = {u.id: u for u in db.scalars(select(User))}
        rows = db.scalars(select(CrossReport).order_by(CrossReport.id.desc()).limit(300)).all()
        return {"reports": [{"id": r.id, "at": iso(r.created_at), "reporter": users[r.reporter_id].name, "subject_phone": r.subject_phone,
                             "subject": users[r.subject_id].name if r.subject_id in users else None, "result": r.result, "codes": r.codes} for r in rows]}

    if portal != "all":
        always = {"/health", "/openapi.json", "/docs", "/docs/oauth2-redirect", "/redoc"}
        want_admin = portal == "admin"
        app.router.routes = [r for r in app.router.routes
                             if not hasattr(r, "path") or r.path in always or r.path.startswith("/admin") == want_admin]
    return app


def create_site_app(portal: str = "user") -> FastAPI:
    """One portal = one website: its API under /api plus its own built web app (dist/user or dist/admin) at /."""
    from pathlib import Path
    from fastapi.staticfiles import StaticFiles
    from starlette.responses import FileResponse

    site = FastAPI(title=f"NiPay {portal} site")
    site.mount("/api", create_app(portal=portal))
    dist = Path(__file__).resolve().parent.parent.parent / "dist" / portal
    if dist.exists():
        class SPA(StaticFiles):
            async def get_response(self, path, scope):
                resp = await super().get_response(path, scope)
                if resp.status_code == 404:
                    return FileResponse(dist / "index.html")
                # the service worker file must never be cached by the browser's HTTP cache
                if path in ("sw.js", "index.html", ""):
                    resp.headers["Cache-Control"] = "no-cache"
                return resp
        site.mount("/", SPA(directory=dist, html=True))
    return site
