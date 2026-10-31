import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Btn, Card, Err, Field, Notice, Title, errText, go } from '../ui';
import { register, login, cancelOtherDevice } from '../lib/actions';
import { useDevice } from '../lib/device';

export function Welcome() {
  return (
    <div className="space-y-4 pt-8">
      <h1 className="text-3xl font-bold">NiPay</h1>
      <p className="text-slate-600">Offline payments that settle at the bank. Phones carry signed points; the money stays in the bank.</p>
      <Notice>Prototype. Fake money and test data only. Not approved by any bank, RBI or NPCI.</Notice>
      <Btn onClick={() => go('/signup')} data-testid="to-signup">Create account</Btn>
      <Btn kind="ghost" onClick={() => go('/login')} data-testid="to-login">Sign in</Btn>
    </div>
  );
}

export function Signup() {
  const d = useDevice();
  const [f, setF] = useState({ phone: '', otp: '', name: '', pin: '', address: '', aadhaar: '', pan: '', region: '', bank: '', terms: false, renting: false });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState<{ banks: string[]; regions: string[]; demo_otp: string; demo_otp_note: string } | null>(null);
  useEffect(() => { api('/meta').then((m) => { setMeta(m); setF((x) => ({ ...x, region: m.regions[0], bank: m.banks[0] })); }).catch(() => setMeta(null)); }, []);
  const up = (k: string) => (e: any) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async () => {
    setBusy(true); setErr(null);
    try { await register({ ...f, language: d.language }); go('/selfie'); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <Title back="/welcome" sub="Step 1 of 1 (needs internet)">Sign up and KYC</Title>
      <Field label="Phone number" inputMode="tel" placeholder="+919000000001" value={f.phone} onChange={up('phone')} data-testid="su-phone" />
      <Field label="OTP" inputMode="numeric" value={f.otp} onChange={up('otp')} hint={meta ? `${meta.demo_otp_note} Demo code: ${meta.demo_otp}` : 'Needs internet to load the demo code.'} data-testid="su-otp" />
      <Field label="Full name" value={f.name} onChange={up('name')} data-testid="su-name" />
      <Field label="4 to 6 digit PIN" type="password" inputMode="numeric" value={f.pin} onChange={up('pin')} data-testid="su-pin" />
      <Card className="space-y-3">
        <Notice>KYC accepts TEST data only. Aadhaar and PAN are checked for shape and then thrown away: nothing about them is stored.</Notice>
        <Field label="Aadhaar (test number)" value={f.aadhaar} onChange={up('aadhaar')} placeholder="0000 0000 0000" />
        <Field label="PAN (test)" value={f.pan} onChange={up('pan')} placeholder="TESTP0000T" />
        <Field label="Address (test)" value={f.address} onChange={up('address')} />
        <p className="text-xs text-slate-400">Next step after sign-up: an optional camera selfie (with consent). Fingerprint or face unlock is set up in More.</p>
      </Card>
      <label className="block text-sm">Region
        <select className="mt-1 w-full border rounded-lg p-2.5" value={f.region} onChange={up('region')}>{(meta?.regions ?? []).map((r) => <option key={r}>{r}</option>)}</select></label>
      <label className="block text-sm">Your bank (fictional)
        <select className="mt-1 w-full border rounded-lg p-2.5" value={f.bank} onChange={up('bank')}>{(meta?.banks ?? []).map((b) => <option key={b}>{b}</option>)}</select></label>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={f.terms} onChange={up('terms')} data-testid="su-terms" /> I accept the terms (test prototype, fake money).</label>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={f.renting} onChange={up('renting')} data-testid="su-renting" /> I will not rent, sell or share my account.</label>
      <Err msg={err} />
      <Btn disabled={busy} onClick={submit} data-testid="su-submit">{busy ? 'Creating...' : 'Create account'}</Btn>
    </div>
  );
}

export function Login() {
  const [phone, setPhone] = useState(''); const [pin, setPin] = useState('');
  const [err, setErr] = useState<string | null>(null); const [lock, setLock] = useState<any>(null);
  const [reason, setReason] = useState('');
  const submit = async () => {
    setErr(null);
    try { await login(phone, pin); go('/'); } catch (e: any) { if (e?.status === 409) setLock(e.detail); else setErr(errText(e)); }
  };
  const cancel = async () => {
    setErr(null);
    try { await cancelOtherDevice(phone, pin, reason, `main ${lock.main_balance}, send ${lock.send_bucket}, receive ${lock.receive_bucket}`); go('/'); } catch (e) { setErr(errText(e)); }
  };
  if (lock) return (
    <div className="space-y-3">
      <Title>Already active on another device</Title>
      <Card className="space-y-2">
        <p className="text-sm">Only one login at a time. Active now: <b>{lock.device_label}</b>.</p>
        <p className="text-sm">Balance summary: main {lock.main_balance}, send {lock.send_bucket}, receive {lock.receive_bucket}.</p>
        <Notice>If you cancel the other device, its unspent send points are NOT refunded (lost-phone rule). Valid claims on them are still paid.</Notice>
        <Field label="Cancellation report: reason" value={reason} onChange={(e) => setReason(e.target.value)} data-testid="cancel-reason" />
      </Card>
      <Err msg={err} />
      <Btn kind="danger" disabled={reason.length < 3} onClick={cancel} data-testid="cancel-device">File report and cancel the other device</Btn>
      <Btn kind="ghost" onClick={() => setLock(null)}>Back</Btn>
    </div>
  );
  return (
    <div className="space-y-3">
      <Title back="/welcome" sub="Needs internet">Sign in</Title>
      <Field label="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="li-phone" />
      <Field label="PIN" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} data-testid="li-pin" />
      <Err msg={err} />
      <Btn onClick={submit} data-testid="li-submit">Sign in</Btn>
    </div>
  );
}
