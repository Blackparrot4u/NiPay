"""The shared fixture (shared/vectors.json) must agree with the Python reference. The TypeScript side checks
the same file in scripts/vectors.test.ts, so the two implementations are held to the same answers."""
import base64
import json
from pathlib import Path

from nacl.signing import SigningKey, VerifyKey

from nipay.core.idsystem import Rules, phone_check, sign_handover
from nipay.core.wallet import HardwareCounter, MineRecipe, Wallet, audit_mines, find_mines

V = json.loads((Path(__file__).resolve().parents[2] / "shared" / "vectors.json").read_text())
un = base64.b64decode


def rules():
    j = json.loads(un(V["rules_blob"]))
    return Rules(j["m"], tuple(frozenset(x) for x in j["j"]), tuple(j["f"]), frozenset(j["p"]), frozenset(j["t"]))


def test_phone_check_matches_fixture():
    pub, r = VerifyKey(un(V["bank_pub"])), rules()
    for c in V["checks"]:
        got = phone_check(c["pid"], un(c["sig"]), r, pub, blocklist=frozenset({c["pid"]}) if c["block"] else frozenset())
        assert got == c["expect"]
    assert {c["expect"] for c in V["checks"]} >= {"ok", "B", "H", "G"}


def test_mines_and_device_signatures_match_fixture():
    rec = MineRecipe(tuple(V["recipe"]["pos"]), V["recipe"]["t"])
    m = V["mines"]
    assert [list(x) for x in find_mines(rec, [i for i in m["ids"] if i != m["control"]], 15)] == m["found"]
    w = Wallet(rec, m["ids"][:], m["control"], HardwareCounter()); w.arm(15)
    assert w.spend(25) == m["spend25"]
    d = V["device"]; key = SigningKey(bytes.fromhex(d["seed_hex"]))
    assert base64.b64encode(sign_handover(key, d["handover"]["month"], d["handover"]["pid"], d["handover"]["to"])).decode() == d["handover"]["sig"]
    fake = m["audit_fake"]
    w2 = Wallet(rec, fake["points"], m["control"], HardwareCounter()); w2.mines = [tuple(x) for x in fake["mines"]]
    assert audit_mines(w2)["problems"] == fake["result"]["problems"]
