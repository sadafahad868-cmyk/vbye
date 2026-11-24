import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { friendlyAuthError, validateEmail } from '../lib/validate';
import AuthLayout from '../components/AuthLayout';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const from = useLocation().state?.from || '/';

  async function submit(e) {
    e.preventDefault();
    const v = validateEmail(email);
    if (v) return setErr(v);
    if (!password) return setErr('Enter your password.');
    setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return setErr(friendlyAuthError(error));
    nav(from, { replace: true });
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to see what your people are up to.">
      <form onSubmit={submit} className="form" noValidate>
        <label>Email<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {err && <p className="error" role="alert">{err}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <p className="links"><Link to="/forgot-password">Forgot password?</Link></p>
      <p className="links">New here? <Link to="/signup">Create an account</Link></p>
    </AuthLayout>
  );
}
