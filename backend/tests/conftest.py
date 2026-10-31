import base64
import os
import sys
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from nacl.signing import SigningKey

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from nipay.config import Settings, load_secrets  # noqa: E402
from nipay.core.idsystem import phone_check, sign_handover, sign_receipt  # noqa: E402
from nipay.main import create_app  # noqa: E402

b64 = lambda b: base64.b64encode(b).decode()
unb64 = base64.b64decode


class Phone:
    """What the browser app does, in Python: a device key made on the device, offline checks, signed handovers."""

    def __init__(self, client, phone, name="Test", bank="Demo Bank A", pin="1234"):
        self.c, self.phone, self.name, self.pin = client, phone, name, pin
        self.key = SigningKey.generate()
        self.pub = b64(bytes(self.key.verify_key))
        self.points, self.token = [], None
        self.bank = bank

    def h(self):
        return {"Authorization": f"Bearer {self.token}"}

    def register(self):
        r = self.c.post("/auth/register", json={"phone": self.phone, "otp": "123456", "name": self.name, "pin": self.pin,
                                                "device_public_key": self.pub, "device_label": f"{self.name} phone", "accepted_terms": True,
                                                "no_account_renting": True, "bank": self.bank,
                                                "kyc": {"test_aadhaar": "0000 0000 0000", "test_pan": "TESTP0000T", "address": "Test City"}})
        assert r.status_code == 200, r.text
        self.token = r.json()["token"]
        return r.json()

    def topup(self, n):
        r = self.c.post("/wallet/topup", json={"amount": n, "pin": self.pin}, headers=self.h())
        assert r.status_code == 200, r.text
        self.points += r.json()["points"]
        return r.json()

    def value_points(self):
        return [p for p in self.points if p["kind"] == "value"]

    def pay_to(self, other, pt, month=None):
        """Offline handover: signed, plus the receiver's signed receipt."""
        month = month or pt["month"]
        ho = sign_handover(self.key, month, pt["pid"], other.phone)
        rc = sign_receipt(other.key, month, pt["pid"], self.phone)
        return {"month": month, "pid": pt["pid"], "sig": pt["sig"], "handover": b64(ho), "receipt": b64(rc),
                "to_phone": other.phone, "payment_ref": "t" + pt["pid"][:6], "transport": "simulated-bluetooth"}

    def claim(self, e):
        return self.c.post("/claims", json={"claims": [{k: v for k, v in e.items() if k != "receipt"}]}, headers=self.h()).json()["results"][0]

    def sync(self, logs=(), **kw):
        r = self.c.post("/sync", json={"logs": list(logs), **kw}, headers=self.h())
        assert r.status_code == 200, r.text
        return r.json()

    def snap(self, seq_=0, **over):
        """An honest, complete wallet snapshot: every field present, every unspent ID listed."""
        from nipay.core.wallet import find_mines, mine_recipe
        d = {"points": [p["pid"] for p in self.points], "seq": seq_, "counter": seq_, "month": self.points[0]["month"] if self.points else ""}
        d.update(over)
        if "mines" not in over:   # armed like the phone does: a third of the value IDs, three per mine
            ctrl = {p["pid"] for p in self.points if p["kind"] == "control"}
            ids = [x for x in d["points"] if x not in ctrl]
            d["mines"] = find_mines(mine_recipe(self.bank_seed, d["month"]), ids, len(ids) // 3) if len(ids) >= 9 and d["month"] else []
        return d

    def wallet(self):
        return self.c.get("/wallet", headers=self.h()).json()


@pytest.fixture()
def env():
    d = tempfile.mkdtemp()
    st = Settings(data_dir=Path(d), rate_limit_per_min=100000, login_rate_per_min=100000)
    app = create_app(st)
    Phone.bank_seed = app.state.svc.bank.seed
    with TestClient(app) as c:
        yield type("Env", (), {"app": app, "c": c, "svc": app.state.svc, "st": st, "dir": d,
                               "secrets": load_secrets(Path(d)), "phone": lambda self, n, name="P", **k: Phone(c, n, name, **k)})()
