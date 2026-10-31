"""Wallet layer on top of idsystem.py: stack landmines, control key, restore counter, signed rules.

Stack landmine (KT's design): list the wallet's IDs as lines. A monthly recipe picks one
character position per component. Three points form a mine if the characters at those
positions sum to the month's target, mod 36. Spending one leaves a void, and the app
prefers points that keep mines complete and fills voids from incoming points.

HardwareCounter stands in for a real phone's secure counter: it's kept outside the wallet
data, so restoring a saved wallet can't roll it back. Real support varies by phone.
"""
import hashlib
import hmac
import json
import random
from dataclasses import dataclass, field

from nacl.exceptions import BadSignatureError

from .idsystem import LEN, VAL, Bank, Rules, derive_rules

K = 3  # points per mine


@dataclass(frozen=True)
class MineRecipe:
    positions: tuple
    target: int


def mine_recipe(seed: bytes, month: str) -> MineRecipe:
    rng = random.Random(hmac.new(seed, f"mine|{month}".encode(), hashlib.sha256).digest())
    return MineRecipe(tuple(rng.randrange(LEN) for _ in range(K)), rng.randrange(36))


def fits(rec: MineRecipe, a: str, b: str, c: str) -> bool:
    return sum(VAL[x[p]] for x, p in zip((a, b, c), rec.positions)) % 36 == rec.target


def find_mines(rec: MineRecipe, ids: list, want: int) -> list:
    """Greedily finds non-overlapping mines. The last member is solved from the first two."""
    by_char = {}
    for i in ids:
        by_char.setdefault(i[rec.positions[2]], []).append(i)
    free, mines = set(ids), []
    for a in ids:
        if len(mines) >= want:
            break
        if a not in free:
            continue
        for b in ids:
            if b == a or b not in free or a not in free:
                continue
            need = (rec.target - VAL[a[rec.positions[0]]] - VAL[b[rec.positions[1]]]) % 36
            cs = [c for c in by_char.get("0123456789abcdefghijklmnopqrstuvwxyz"[need], []) if c in free and c not in (a, b)]
            if cs:
                mines.append((a, b, cs[0]))
                free -= {a, b, cs[0]}
                break
    return mines


class HardwareCounter:
    def __init__(self):
        self.value = 0

    def next(self) -> int:
        self.value += 1
        return self.value


@dataclass
class Wallet:
    rec: MineRecipe
    points: list
    control: str
    counter: HardwareCounter
    seq: int = 0
    mines: list = field(default_factory=list)
    protect: bool = True

    def arm(self, want: int):
        self.mines = find_mines(self.rec, [p for p in self.points if p != self.control], want)

    def complete(self) -> int:
        have = set(self.points)
        return sum(all(x in have for x in m) for m in self.mines)

    def save(self) -> dict:
        return {"points": list(self.points), "seq": self.seq, "mines": list(self.mines)}

    def restore(self, snap: dict):
        self.points, self.seq, self.mines = list(snap["points"]), snap["seq"], list(snap["mines"])

    def restored(self) -> bool:
        return self.seq != self.counter.value

    def spend(self, n: int) -> list:
        """Spends loose points first when protecting; real points are never the control key."""
        spendable = [p for p in self.points if p != self.control]
        if self.protect:
            # KT's rule: loose points first, then pieces of already-broken mines, then whole mines one at a time.
            have, whole, broken = set(self.points), [], []
            for m in self.mines:
                (whole if all(x in have for x in m) else broken).append(m)
            whole_pts = [x for m in whole for x in m]
            broken_pts = [x for m in broken for x in m if x in have]
            used = set(whole_pts) | set(broken_pts)
            order = [p for p in spendable if p not in used] + broken_pts + whole_pts
        else:
            order = random.Random(self.seq).sample(spendable, len(spendable))
        out = order[:n]
        self.points = [p for p in self.points if p not in out]
        self.seq = self.counter.next()
        return out

    def receive_fill(self, incoming: list) -> int:
        """Refills broken mines from incoming points, prioritising completing the pattern."""
        filled, pool, have = 0, list(incoming), set(self.points)
        for idx, m in enumerate(self.mines):
            missing = [x for x in m if x not in have]
            if len(missing) != 1 or not pool:
                continue
            slot = m.index(missing[0])
            for c in pool:
                new = tuple(c if j == slot else x for j, x in enumerate(m))
                if fits(self.rec, *new):
                    self.mines[idx] = new
                    self.points.append(c)
                    have.add(c)
                    pool.remove(c)
                    filled += 1
                    break
        return filled


def rules_blob(r: Rules) -> bytes:
    return json.dumps({"m": r.month, "j": [sorted(x) for x in r.joints], "f": list(r.floor_mod),
                       "p": sorted(r.bad_pairs), "t": sorted(r.bad_triples)}, separators=(",", ":")).encode()


def sign_rules(bank: Bank, r: Rules) -> tuple:
    blob = rules_blob(r)
    return blob, bank.signing.sign(blob).signature


def accept_rules(pub, blob: bytes, sig: bytes) -> bool:
    try:
        pub.verify(blob, sig)
        return True
    except (BadSignatureError, ValueError):
        return False


def code_digest(code: bytes, month: str, block: tuple) -> str:
    """Random code-block check: hash a month-chosen block. The bank knows the right answer."""
    start, end = block
    return hashlib.sha256(month.encode() + code[start:end]).hexdigest()


def choose_block(seed: bytes, month: str, size: int, length: int = 256) -> tuple:
    rng = random.Random(hmac.new(seed, f"block|{month}".encode(), hashlib.sha256).digest())
    start = rng.randrange(max(1, size - length))
    return start, start + length


def audit_mines(w: "Wallet") -> dict:
    """Count: mines should be points left / 3. Working: each one must really fit the recipe."""
    have = set(w.points)
    whole = [m for m in w.mines if all(x in have for x in m)]
    fake = [m for m in whole if not fits(w.rec, *m)]
    expected = max(0, (len(w.points) - 1) // K - 1)  # control key excluded; 1 of slack for leftovers
    problems = []
    if fake:
        problems.append("mine_does_not_fit")
    if len(whole) < expected:
        problems.append("too_few_mines")
    return {"whole": len(whole), "expected_at_least": expected, "fake": len(fake), "problems": problems}


def sign_trust(bank: Bank, user: str, score: int, age_days: int, month: str, extra: dict | None = None) -> tuple:
    """Trust is worked out at the bank and signed. The phone only carries it.
    extra (certificate fields): d device public key, ls/lr send/receive limit, x expiry (unix seconds)."""
    blob = json.dumps({"u": user, "s": score, "a": age_days, "m": month, **(extra or {})}, separators=(",", ":")).encode()
    return blob, bank.signing.sign(blob).signature


def whole_code_digest(code: bytes, month: str, nonce: bytes) -> str:
    """Whole-app check at sync. The bank holds the right answer per official build."""
    return hashlib.sha256(month.encode() + nonce + code).hexdigest()
