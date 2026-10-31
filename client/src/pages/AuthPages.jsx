import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { requestPasswordReset, resetPassword } from '../api/auth';

function AuthFrame({ title, children }) {
  return <main className="grid min-h-screen place-items-center bg-slate-950 px-4 py-10 text-slate-100"><section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-7 shadow-2xl"><Link to="/" className="text-sm font-bold text-indigo-300">Brightloop</Link><h1 className="mt-5 text-2xl font-bold">{title}</h1>{children}</section></main>;
}

function Message({ error, success }) {
  if (!error && !success) return null;
  return <p role="status" className={`rounded-lg px-3 py-2 text-sm ${error ? 'bg-rose-500/10 text-rose-300' : 'bg-emerald-500/10 text-emerald-300'}`}>{error || success}</p>;
}

function Field({ label, type = 'text', name, autoComplete, required = true, minLength }) {
  return <label className="grid gap-1.5 text-sm text-slate-300">{label}<input className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-400" type={type} name={name} autoComplete={autoComplete} required={required} minLength={minLength} /></label>;
}

function Submit({ children }) {
  return <button className="w-full rounded-lg bg-indigo-500 px-4 py-2.5 font-semibold text-white hover:bg-indigo-400 disabled:opacity-60" type="submit">{children}</button>;
}

function errorMessage(error) {
  return error.response?.data?.error?.message || 'Something went wrong. Please try again.';
}

function destination(role) {
  return role === 'ADMIN' ? '/admin' : role === 'STAFF' ? '/staff' : '/portal';
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try { const user = await login(values); navigate(destination(user.role), { replace: true }); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <AuthFrame title="Sign in"><form className="mt-6 grid gap-4" onSubmit={submit}><Message error={error} /><Field label="Email" name="email" type="email" autoComplete="email" /><Field label="Password" name="password" type="password" autoComplete="current-password" /><Submit>{busy ? 'Signing in…' : 'Sign in'}</Submit></form><div className="mt-5 flex justify-between text-sm"><Link className="text-indigo-300 hover:text-indigo-200" to="/forgot-password">Forgot password?</Link><Link className="text-slate-400 hover:text-white" to="/signup">Create account</Link></div></AuthFrame>;
}

export function SignupPage() {
  const { signup } = useAuth(); const navigate = useNavigate(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try { await signup(values); navigate('/login', { replace: true, state: { notice: 'Account created. Sign in to continue.' } }); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <AuthFrame title="Create your account"><form className="mt-6 grid gap-4" onSubmit={submit}><Message error={error} /><Field label="Name" name="name" autoComplete="name" /><Field label="Email" name="email" type="email" autoComplete="email" /><Field label="Password (9+ characters, uppercase, lowercase and a special character)" name="password" type="password" autoComplete="new-password" minLength={9} /><Submit>{busy ? 'Creating account…' : 'Create account'}</Submit></form><p className="mt-5 text-sm text-slate-400">Already registered? <Link className="text-indigo-300" to="/login">Sign in</Link></p></AuthFrame>;
}

export function ForgotPasswordPage() {
  const [error, setError] = useState(''); const [success, setSuccess] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError(''); setSuccess(''); setBusy(true);
    try { const result = await requestPasswordReset(new FormData(event.currentTarget).get('email')); setSuccess(result.message || 'If an account exists, a reset link has been sent.'); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <AuthFrame title="Reset your password"><p className="mt-2 text-sm text-slate-400">Enter your account email and we’ll send a reset link if it exists.</p><form className="mt-6 grid gap-4" onSubmit={submit}><Message error={error} success={success} /><Field label="Email" name="email" type="email" autoComplete="email" /><Submit>{busy ? 'Sending…' : 'Send reset link'}</Submit></form><p className="mt-5 text-sm"><Link className="text-indigo-300" to="/login">Back to sign in</Link></p></AuthFrame>;
}

export function ResetPasswordPage() {
  const [params] = useSearchParams(); const [error, setError] = useState(''); const [success, setSuccess] = useState(''); const [busy, setBusy] = useState(false); const navigate = useNavigate();
  async function submit(event) {
    event.preventDefault(); setError(''); setSuccess(''); setBusy(true);
    const password = new FormData(event.currentTarget).get('password');
    try { const result = await resetPassword({ token: params.get('token'), password }); setSuccess(result.message || 'Password updated. You can sign in now.'); setTimeout(() => navigate('/login', { replace: true }), 900); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <AuthFrame title="Choose a new password"><form className="mt-6 grid gap-4" onSubmit={submit}><Message error={error} success={success} />{!params.get('token') && <Message error="This reset link is missing its token." />}<Field label="New password (9+ characters, uppercase, lowercase and a special character)" name="password" type="password" autoComplete="new-password" minLength={9} /><Submit>{busy ? 'Updating…' : 'Update password'}</Submit></form></AuthFrame>;
}
