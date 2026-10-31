import os
import sys

import uvicorn

from .config import Settings, load_secrets

PORTS = {"user": 8000, "admin": 8001}

if __name__ == "__main__":
    portal = sys.argv[1] if len(sys.argv) > 1 else "user"
    if portal not in PORTS:
        sys.exit("usage: python -m nipay [user|admin]")
    st = Settings()
    sec = load_secrets(st.data_dir)
    port = int(os.environ.get("PORT", PORTS[portal]))
    print(f"NiPay {portal} site on port {port}. Fake money and test data only.")
    if portal == "user":
        print(f"  demo OTP (mock, no SMS): {st.otp}")
    else:
        print("  admin logins (passwords in gitignored backend/data/secrets.json): " + ", ".join(sec["admins"].keys()))
    from .main import create_site_app
    uvicorn.run(create_site_app(portal), host=os.environ.get("HOST", "0.0.0.0"), port=port)
