import os

import uvicorn

from .config import Settings, load_secrets

if __name__ == "__main__":
    st = Settings()
    sec = load_secrets(st.data_dir)
    print("NiPay demo API. Fake money and test data only.")
    print(f"  database: {st.database_url}")
    print(f"  demo OTP (mock, no SMS): {st.otp}")
    print("  admin logins (from gitignored backend/data/secrets.json): " + ", ".join(sec["admins"].keys()))
    uvicorn.run("nipay.main:create_site_app", factory=True, host=os.environ.get("HOST", "0.0.0.0"), port=int(os.environ.get("PORT", "8000")))
