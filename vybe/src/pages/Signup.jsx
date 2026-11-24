import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { friendlyAuthError, validateEmail, validatePassword, validateUsername } from '../lib/validate';
import AuthLayout from '../components/AuthLayout';

export default function Signup() {
  const [f, setF] = useState({ email: '', password: '', username: '', display: '' });
  const [u, setU] = useState({ state: 'idle', msg: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [cool, setCool] = useState(0);
  const [age, setAge] = useState(false);
  const nav = useNavigate();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  // Live username check (format first, then availability from the database).
  useEffect(() => {
    const name = f.username.toLowerCase();
    if (!name) return setU({ state: 'idle', msg: '' });
    const bad = validateUsername(name);
    if (bad) return setU({ state: 'bad', msg: bad });
    setU({ state: 'checking', msg: 'Checking…' });
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('username_available', { name });
      if (error) return setU({ state: 'idle', msg: '' });
      setU(data ? { state: 'ok', msg: 'Available' } : { state: 'bad', msg: 'Already taken' });
    }, 400);
    return () => clearTimeout(t);
  }, [f.username]);

  useEffect(() => {
    if (cool <= 0) return;
    const t = setTimeout(() => setCool(cool - 1), 1000);
    return () => clearTimeout(t);
  }, [cool]);

  async function submit(e) {
    e.preventDefault();
    const problem = validateUsername(f.username.toLowerCase()) || validateEmail(f.email) || validatePassword(f.password);
    if (problem) return setErr(problem);
    if (!age) return setErr('You must be 13 or older to join.');
    if (u.state === 'bad') return setErr(u.msg);
    setBusy(true); setErr('');
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.password,
      options: {
        emailRedirectTo: window.location.origin + '/login',
        data: { username: f.username.toLowerCase(), display_name: f.display.trim() },
      },
    });
    setBusy(false);
    if (error) return setErr(friendlyAuthError(error));
    if (data.session) return nav('/', { replace: true }); // email confirmation turned off
    setSent(true); setCool(60);
  }

  async function resend() {
    setCool(60);
    await supabase.auth.resend({ type: 'signup', email: f.email.trim(), options: { emailRedirectTo: window.location.origin + '/login' } });
  }

  if (sent) {
    return (
      <AuthLayout title="Check your email" subtitle={`We sent a verification link to ${f.email}. Open it, then log in.`}>
        <button className="btn ghost" onClick={resend} disabled={cool > 0}>{cool > 0 ? `Resend in ${cool}s` : 'Resend email'}</button>
        <p className="links"><Link to="/login">Go to log in</Link></p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account" subtitle="Pick a username. It becomes your profile link.">
      <form onSubmit={submit} className="form" noValidate>
        <label>Username
          <input value={f.username} onChange={set('username')} autoCapitalize="none" autoComplete="username" maxLength={20} />
          {u.msg && <small className={'hint ' + u.state}>{u.msg}</small>}
        </label>
        <label>Display name<input value={f.display} onChange={set('display')} maxLength={40} /></label>
        <label>Email<input type="email" autoComplete="email" value={f.email} onChange={set('email')} /></label>
        <label>Password<input type="password" autoComplete="new-password" value={f.password} onChange={set('password')} />
          <small className="hint">At least 8 characters with a letter and a number.</small>
        </label>
        <label className="switch"><input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} /><span>I am 13 or older and agree to be respectful.</span></label>
        {err && <p className="error" role="alert">{err}</p>}
        <button className="btn" disabled={busy || u.state === 'checking'}>{busy ? 'Creating…' : 'Create account'}</button>
      </form>
      <p className="links">Already have an account? <Link to="/login">Log in</Link></p>
    </AuthLayout>
  );
}
