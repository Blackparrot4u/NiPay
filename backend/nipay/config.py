"""Settings and the secrets store.

The bank signing key, monthly seed and admin passwords are generated on first run and kept in a
gitignored file (backend/data/secrets.json, mode 0600) or taken from environment variables.
They are never committed and never returned by an API.
"""
import base64
import json
import os
import secrets
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ADMIN_USERS = (("admin", "SUPER_ADMIN"), ("risk", "FRAUD_INVESTIGATOR"), ("auditor", "READ_ONLY"))


@dataclass
class Settings:
    data_dir: Path = field(default_factory=lambda: Path(os.environ.get("NIPAY_DATA_DIR", ROOT / "data")))
    database_url: str = ""
    rate_limit_per_min: int = int(os.environ.get("NIPAY_RATE_LIMIT", "600"))
    login_rate_per_min: int = int(os.environ.get("NIPAY_LOGIN_RATE", "20"))
    grace_days: int = 38  # design: 35-40 days after month end
    topup_fee: int = 1
    send_limit: int = 2000
    receive_limit: int = 10000
    simultaneous_alert: int = 10  # claimants on one point that raise an alert
    test_funds: int = 50000  # fake money given at sign-up
    otp: str = os.environ.get("NIPAY_DEMO_OTP", "123456")  # MOCK: no SMS is sent
    # each website has its own origin and its own list: the user site never allows the admin origin, and the reverse
    cors_origins: tuple = ("http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8000", "http://127.0.0.1:8000")
    admin_cors_origins: tuple = ("http://localhost:3001", "http://127.0.0.1:3001", "http://localhost:8001", "http://127.0.0.1:8001")

    def __post_init__(self):
        self.data_dir = Path(self.data_dir)
        if not self.database_url:
            self.database_url = os.environ.get("DATABASE_URL") or f"sqlite:///{self.data_dir / 'nipay.db'}"


def load_secrets(data_dir: Path) -> dict:
    """Env vars win; otherwise read or create the gitignored secrets file."""
    data_dir.mkdir(parents=True, exist_ok=True)
    path = data_dir / "secrets.json"
    store = json.loads(path.read_text()) if path.exists() else {}
    changed = False
    if os.environ.get("NIPAY_SIGNING_KEY"):
        store["signing_key"] = os.environ["NIPAY_SIGNING_KEY"]
    if os.environ.get("NIPAY_SEED"):
        store["seed"] = os.environ["NIPAY_SEED"]
    for key in ("signing_key", "seed"):
        if key not in store:
            store[key] = base64.b64encode(secrets.token_bytes(32)).decode()
            changed = True
    store.setdefault("admins", {})
    for name, _role in ADMIN_USERS:
        env = os.environ.get(f"NIPAY_ADMIN_PASSWORD_{name.upper()}")
        if env:
            store["admins"][name] = env
        elif name not in store["admins"]:
            store["admins"][name] = secrets.token_urlsafe(9)
            changed = True
    if changed:
        path.write_text(json.dumps(store, indent=1))
        os.chmod(path, 0o600)
    return store
