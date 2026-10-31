# Deploy on Render (demo)

Two web services from this repo, one per site, sharing one Postgres. Branch: `stable-demo`.

1. Create a **Render Postgres**. Copy its internal URL, and change the start to `postgresql+psycopg://`.
2. Make two secrets once (32 random bytes, base64): `python3 -c "import os,base64;print(base64.b64encode(os.urandom(32)).decode())"`. Use the SAME values on both services: `NIPAY_SIGNING_KEY`, `NIPAY_SEED`. Never commit them.
3. Create two **Web Services** on branch `stable-demo`:
   - Build: `npm install && npm run build && pip install -r backend/requirements.txt`
   - Start, user site: `cd backend && python -m nipay user`
   - Start, admin site: `cd backend && python -m nipay admin`
   - Env on both: `DATABASE_URL`, `NIPAY_SIGNING_KEY`, `NIPAY_SEED`, and for admin also `NIPAY_ADMIN_PASSWORD_ADMIN`.
4. Open the user service's https link on phones. Cameras and passkeys need https, which Render gives.
5. Free services sleep after idle time and take about a minute to wake: open them before presenting.
Not tested here: this guide was written without running a Render deploy.
