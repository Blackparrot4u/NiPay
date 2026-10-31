"""Point ID generator and offline checker (design v1).

An ID is 20 characters from 0-9a-z: five 4-character "floors" of a tower.
Each month the bank draws a secret seed and derives from it:

  Layer B, tower: adjoining floors must interlock. For each joint, the sum of
      the last char of a floor and the first char of the next, mod 36, must be
      in that joint's allowed set. Plus each floor's char sum mod 6 is fixed.
  Layer A, landmines: some pairs and triples are never issued.
  Layer H, signature: the bank signs every ID with its month. Only the public
      key is on phones.

Phones hold the month's Rules (A and B) and the public key. An attacker can read
those from his own phone. He cannot read the signing key, which stays at the bank.
"""
import hashlib
import hmac
import random
import secrets
from functools import lru_cache
from dataclasses import dataclass

from nacl.exceptions import BadSignatureError
from nacl.signing import SigningKey, VerifyKey

ALPHA = "0123456789abcdefghijklmnopqrstuvwxyz"
VAL = {c: i for i, c in enumerate(ALPHA)}
LEN, FLOOR = 20, 4


@dataclass(frozen=True)
class Rules:
    """What every phone carries for a month, and so what an attacker can extract."""
    month: str
    joints: tuple  # 4 frozensets of allowed (last+first) mod 36
    floor_mod: tuple  # 5 required floor sums mod 6
    bad_pairs: frozenset
    bad_triples: frozenset


def derive_rules(seed: bytes, month: str, joint_keep=12, bad_pair_share=0.05, bad_triple_share=0.05) -> Rules:
    rng = random.Random(hmac.new(seed, month.encode(), hashlib.sha256).digest())
    joints = tuple(frozenset(rng.sample(range(36), joint_keep)) for _ in range(4))
    floor_mod = tuple(rng.randrange(6) for _ in range(5))
    pairs = [a + b for a in ALPHA for b in ALPHA]
    triples = [a + b + c for a in ALPHA for b in ALPHA for c in ALPHA]
    return Rules(month, joints, floor_mod,
                 frozenset(rng.sample(pairs, int(len(pairs) * bad_pair_share))),
                 frozenset(rng.sample(triples, int(len(triples) * bad_triple_share))))


def check_landmines(pid: str, r: Rules) -> bool:
    return not (any(pid[i:i + 2] in r.bad_pairs for i in range(LEN - 1))
                or any(pid[i:i + 3] in r.bad_triples for i in range(LEN - 2)))


def check_tower(pid: str, r: Rules) -> bool:
    if len(pid) != LEN or any(c not in VAL for c in pid):
        return False
    floors = [pid[i:i + FLOOR] for i in range(0, LEN, FLOOR)]
    if any(sum(VAL[c] for c in f) % 6 != m for f, m in zip(floors, r.floor_mod)):
        return False
    return all((VAL[floors[i][-1]] + VAL[floors[i + 1][0]]) % 36 in r.joints[i] for i in range(4))


def make_id(r: Rules) -> str:
    """Secure random, rejected until it obeys the month's rules."""
    while True:
        chars = [secrets.choice(ALPHA) for _ in range(LEN)]
        # Build the tower floor by floor: set each joint, then fix the floor's sum with its middle char.
        for f in range(5):
            s = f * FLOOR
            if f:
                allowed = sorted(r.joints[f - 1])
                target = allowed[secrets.randbelow(len(allowed))]
                chars[s] = ALPHA[(target - VAL[chars[s - 1]]) % 36]
            need = (r.floor_mod[f] - sum(VAL[c] for c in chars[s:s + FLOOR])) % 6
            chars[s + 1] = ALPHA[(VAL[chars[s + 1]] + need) % 36]
        pid = "".join(chars)
        if check_tower(pid, r) and check_landmines(pid, r):
            return pid


@lru_cache(maxsize=16)
def cached_rules(seed: bytes, month: str) -> Rules:
    """derive_rules is pure but builds ~48k candidates, so the server caches it per (seed, month)."""
    return derive_rules(seed, month)


class Bank:
    def __init__(self, seed: bytes | None = None, signing: SigningKey | None = None):
        # NiPay server: the key and seed are loaded from a secrets store, not generated per run.
        self.signing = signing or SigningKey.generate()
        self.public = self.signing.verify_key
        self.seed = seed or secrets.token_bytes(32)
        self.issued = {}  # (month, id) -> user
        self.claimed = {}  # (month, id) -> first claimant
        self.held = []  # later claims on a claimed point
        self.devices = {}  # user -> device public key, registered at KYC

    def rules(self, month: str) -> Rules:
        return cached_rules(self.seed, month)

    def issue(self, user: str, month: str, n: int) -> list:
        r, out = self.rules(month), []
        for _ in range(n):
            pid = make_id(r)
            while (month, pid) in self.issued:
                pid = make_id(r)
            self.issued[(month, pid)] = user
            # The month is inside the signature, so reused IDs can't replay across months.
            out.append((pid, self.signing.sign(f"{month}|{pid}".encode()).signature))
        return out

    def register(self, user: str) -> SigningKey:
        """Device key made at KYC. Real phones would keep it in secure hardware."""
        key = SigningKey.generate()
        self.devices[user] = key.verify_key
        return key

    def claim(self, claimant: str, month: str, pid: str, sig: bytes, handover: bytes) -> str:
        if not verify_sig(self.public, month, pid, sig) or (month, pid) not in self.issued:
            return "forged"
        owner = self.issued[(month, pid)]
        if not verify_handover(self.devices.get(owner), month, pid, claimant, handover):
            return "no_handover"
        if (month, pid) in self.claimed:
            self.held.append((month, pid, claimant, self.issued[(month, pid)]))
            return "held_double"
        self.claimed[(month, pid)] = claimant
        return "paid"


def verify_sig(pub: VerifyKey, month: str, pid: str, sig: bytes) -> bool:
    try:
        pub.verify(f"{month}|{pid}".encode(), sig)
        return True
    except (BadSignatureError, ValueError):
        return False


def sign_handover(key: SigningKey, month: str, pid: str, to: str) -> bytes:
    """Owner's device signs "this point goes to this person"."""
    return key.sign(f"{month}|{pid}|{to}".encode()).signature


def verify_handover(pub, month: str, pid: str, to: str, handover: bytes) -> bool:
    if pub is None:
        return False
    try:
        pub.verify(f"{month}|{pid}|{to}".encode(), handover)
        return True
    except (BadSignatureError, ValueError):
        return False


def phone_check(pid: str, sig: bytes, r: Rules, pub: VerifyKey, use=("B", "A", "H"), blocklist=frozenset()) -> str:
    """B's phone, no internet. Returns the name of the first failed layer, or 'ok'."""
    if "B" in use and not check_tower(pid, r):
        return "B"
    if "A" in use and not check_landmines(pid, r):
        return "A"
    if "H" in use and not verify_sig(pub, r.month, pid, sig):
        return "H"
    if pid in blocklist:
        return "G"
    return "ok"


def sign_receipt(key: SigningKey, month: str, pid: str, sender: str) -> bytes:
    """Receiver's device signs "I received this point from this person" (the signed 'received' of FLOW.md)."""
    return key.sign(f"{month}|{pid}|{sender}|received".encode()).signature


def verify_receipt(pub, month: str, pid: str, sender: str, receipt: bytes) -> bool:
    if pub is None:
        return False
    try:
        pub.verify(f"{month}|{pid}|{sender}|received".encode(), receipt)
        return True
    except (BadSignatureError, ValueError):
        return False
