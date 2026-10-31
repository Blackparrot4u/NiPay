import hashlib
import hmac
import secrets
import time
from collections import defaultdict, deque


def hash_pin(pin: str) -> str:
    salt = secrets.token_bytes(16)
    h = hashlib.scrypt(pin.encode(), salt=salt, n=2**13, r=8, p=1, dklen=32)
    return salt.hex() + "$" + h.hex()


def check_pin(pin: str, stored: str) -> bool:
    salt, h = stored.split("$")
    cand = hashlib.scrypt(pin.encode(), salt=bytes.fromhex(salt), n=2**13, r=8, p=1, dklen=32)
    return hmac.compare_digest(cand.hex(), h)


def new_token() -> tuple:
    t = secrets.token_urlsafe(32)
    return t, hash_token(t)


def hash_token(t: str) -> str:
    return hashlib.sha256(t.encode()).hexdigest()


class RateLimiter:
    """Sliding one-minute window per (client, bucket). In memory: one server process."""

    def __init__(self):
        self.hits = defaultdict(deque)

    def allow(self, key, limit: int) -> bool:
        now = time.monotonic()
        q = self.hits[key]
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= limit:
            return False
        q.append(now)
        return True


class PinGuard:
    """Locks a phone number for 15 minutes after 5 wrong PINs."""

    def __init__(self):
        self.fails = defaultdict(list)

    def locked(self, phone) -> bool:
        t = time.monotonic()
        self.fails[phone] = [x for x in self.fails[phone] if t - x < 900]
        return len(self.fails[phone]) >= 5

    def fail(self, phone):
        self.fails[phone].append(time.monotonic())

    def ok(self, phone):
        self.fails.pop(phone, None)
