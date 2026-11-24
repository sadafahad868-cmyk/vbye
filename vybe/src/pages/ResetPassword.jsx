import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { friendlyAuthError, validatePassword } from '../lib/validate';
import AuthLayout from '../components/AuthLayout';
import { Splash } from '../components/Guards';

export default function ResetPassword() {
  const { user, loading } = useAuth();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  if (loading) return <Splash />;
  // The emailed link signs the person in temporarily. No session means the link is invalid or expired.
  if (!user) {
    return (
      <AuthLayout title="Link expired" subtitle="This reset link is invalid or has expired.">
        <Link className="btn" to="/forgot-password">Request a new link</Link>
      </AuthLayout>
    );
  }

  async function submit(e) {
    e.preventDefault();
    const v = validatePassword(pw);
    if (v) return setErr(v);
    setBusy(true); setErr('');
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(friendlyAuthError(error));
    nav('/', { replace: true });
  }

  return (
    <AuthLayout title="Choose a new password">
      <form onSubmit={submit} className="form" noValidate>
        <label>New password<input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        {err && <p className="error" role="alert">{err}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
      </form>
    </AuthLayout>
  );
}
