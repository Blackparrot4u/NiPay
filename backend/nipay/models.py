from datetime import datetime, timezone

from sqlalchemy import (JSON, BigInteger, Boolean, DateTime, ForeignKey, Index, Integer, String, Text,
                        UniqueConstraint, text)
from sqlalchemy.types import TypeDecorator
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def now():
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """SQLite drops time zones; this always hands back an aware UTC datetime."""
    impl = DateTime(timezone=True)
    cache_ok = True

    def process_result_value(self, value, dialect):
        return value.replace(tzinfo=timezone.utc) if value is not None and value.tzinfo is None else value


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(80))
    pin_hash: Mapped[str] = mapped_column(String(200))
    bank: Mapped[str] = mapped_column(String(40), default="Demo Bank A")  # fictional names only
    region: Mapped[str] = mapped_column(String(40), default="Plains")
    language: Mapped[str] = mapped_column(String(4), default="en")
    kyc_status: Mapped[str] = mapped_column(String(20), default="TEST_VERIFIED")
    address_city: Mapped[str] = mapped_column(String(60), default="")
    main_balance: Mapped[int] = mapped_column(BigInteger, default=0)
    send_bucket: Mapped[int] = mapped_column(BigInteger, default=0)
    receive_bucket: Mapped[int] = mapped_column(BigInteger, default=0)
    offline_suspended: Mapped[bool] = mapped_column(Boolean, default=False)
    suspend_reason: Mapped[str] = mapped_column(String(200), default="")
    trust_reset_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now)
    last_sync_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)


class Device(Base):
    __tablename__ = "devices"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    public_key: Mapped[str] = mapped_column(String(64))  # base64 Ed25519, private half never leaves the device
    label: Mapped[str] = mapped_column(String(80), default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now)
    cancelled_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    cancel_reason: Mapped[str] = mapped_column(Text, default="")


class Session(Base):
    __tablename__ = "sessions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    device_id: Mapped[int | None] = mapped_column(ForeignKey("devices.id"), nullable=True)
    admin_name: Mapped[str | None] = mapped_column(String(30), nullable=True)
    admin_role: Mapped[str | None] = mapped_column(String(30), nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Point(Base):
    """One server-made 20-character ID, signed with its month."""
    __tablename__ = "points"
    __table_args__ = (UniqueConstraint("month", "pid"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    month: Mapped[str] = mapped_column(String(7))
    pid: Mapped[str] = mapped_column(String(20))
    sig: Mapped[str] = mapped_column(String(100))
    kind: Mapped[str] = mapped_column(String(10), default="value")  # value | control
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id"))
    status: Mapped[str] = mapped_column(String(12), default="issued")  # issued | spent | cancelled
    issued_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now)


class Transfer(Base):
    """A log line: owner handed a point to a receiver. One row per (point, receiver)."""
    __tablename__ = "transfers"
    __table_args__ = (
        UniqueConstraint("point_id", "to_user_id"),
        # The database itself refuses a second paid claim on the same point, even under a race.
        Index("one_paid_per_point", "point_id", unique=True, sqlite_where=text("status = 'paid'"),
              postgresql_where=text("status = 'paid'")),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    point_id: Mapped[int] = mapped_column(ForeignKey("points.id"), index=True)
    from_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    to_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    handover: Mapped[str] = mapped_column(String(100))
    receipt: Mapped[str] = mapped_column(String(100), default="")
    status: Mapped[str] = mapped_column(String(10), default="pending")  # pending | paid | held
    reason: Mapped[str] = mapped_column(String(80), default="")
    payment_ref: Mapped[str] = mapped_column(String(40), default="")
    transport: Mapped[str] = mapped_column(String(20), default="")
    client_ts: Mapped[str] = mapped_column(String(40), default="")
    source: Mapped[str] = mapped_column(String(10), default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now)
    settled_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    batch_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    point = relationship("Point")


class LedgerEntry(Base):
    """Every money move. The d_* columns of one entry always sum to zero."""
    __tablename__ = "ledger"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ts: Mapped[datetime] = mapped_column(UTCDateTime, default=now)
    kind: Mapped[str] = mapped_column(String(24))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    ref: Mapped[str] = mapped_column(String(60), default="")
    d_main: Mapped[int] = mapped_column(BigInteger, default=0)
    d_send: Mapped[int] = mapped_column(BigInteger, default=0)
    d_recv: Mapped[int] = mapped_column(BigInteger, default=0)
    d_pool: Mapped[int] = mapped_column(BigInteger, default=0)   # money the bank keeps (lost phones)
    d_fees: Mapped[int] = mapped_column(BigInteger, default=0)
    d_mint: Mapped[int] = mapped_column(BigInteger, default=0)   # fake test funds only
    # claim payouts touch two users; this is the second one
    other_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)


class SecurityEvent(Base):
    """Read-only record of something a tripwire caught. Nobody 'resolves' these."""
    __tablename__ = "security_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[str] = mapped_column(String(30), index=True)
    severity: Mapped[str] = mapped_column(String(10))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    pid: Mapped[str] = mapped_column(String(20), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String(10), default="sync")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now)


class ReviewItem(Base):
    __tablename__ = "review_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[str] = mapped_column(String(20))  # MAP_FLAG | PEER_REPORT | ANOMALOUS_BURST | LOST_PHONE_CLAIM | SAME_ID
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    summary: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(12), default="IN_REVIEW")
    decided_by: Mapped[str] = mapped_column(String(30), default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now)


class Appeal(Base):
    __tablename__ = "appeals"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(20), default="flag")
    reason: Mapped[str] = mapped_column(Text)
    documents: Mapped[list] = mapped_column(JSON, default=list)  # file names only, nothing uploaded in the demo
    status: Mapped[str] = mapped_column(String(20), default="PENDING_DECISION")
    decided_by: Mapped[str] = mapped_column(String(30), default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now)
    deadline: Mapped[datetime] = mapped_column(UTCDateTime)


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(20))
    detail: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now)


class Notice(Base):
    """Bad-ID notices (signed when served)."""
    __tablename__ = "notices"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pid: Mapped[str] = mapped_column(String(20), unique=True)
    reason: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now)


class AuditLog(Base):
    """Append-only; each row hashes the one before it so edits are detectable."""
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ts: Mapped[datetime] = mapped_column(UTCDateTime, default=now)
    actor: Mapped[str] = mapped_column(String(40))
    role: Mapped[str] = mapped_column(String(30))
    action: Mapped[str] = mapped_column(String(40))
    target: Mapped[str] = mapped_column(String(60), default="")
    ip: Mapped[str] = mapped_column(String(45), default="")
    prev_hash: Mapped[str] = mapped_column(String(64), default="")
    row_hash: Mapped[str] = mapped_column(String(64), default="")


class Setting(Base):
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    value: Mapped[str] = mapped_column(Text)


class SettlementBatch(Base):
    __tablename__ = "settlement_batches"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    status: Mapped[str] = mapped_column(String(10), default="OPEN")
    opened_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now)
    settled_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)


class CrossReport(Base):
    """Signed result of one phone checking another at connection. Evidence for logs and review only: it never suspends anybody."""
    __tablename__ = "cross_reports"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    subject_phone: Mapped[str] = mapped_column(String(20), index=True)
    subject_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    result: Mapped[str] = mapped_column(String(8))  # pass | fail
    codes: Mapped[str] = mapped_column(String(200), default="")
    ts: Mapped[int] = mapped_column(BigInteger, default=0)
    nonce: Mapped[str] = mapped_column(String(40), default="")
    sig: Mapped[str] = mapped_column(String(100), unique=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now)
