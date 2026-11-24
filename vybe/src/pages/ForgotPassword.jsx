import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { friendlyAuthError, validateEmail } from '../lib/validate';
import AuthLayout from '../components/AuthLayout';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const v = validateEmail(email);
    if (v) return setErr(v);
    setBusy(true); setErr('');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + '/reset-password' });
    setBusy(false);
    if (error) return setErr(friendlyAuthError(error));
    setDone(true);
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We will email you a link to choose a new one.">
      {done ? <p className="ok">If an account exists for that email, a reset link is on its way.</p> : (
        <form onSubmit={submit} className="form" noValidate>
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          {err && <p className="error" role="alert">{err}</p>}
          <button className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
      <p className="links"><Link to="/login">Back to log in</Link></p>
    </AuthLayout>
  );
}
