import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { friendlyError } from '../lib/validate';

const REASONS = [['spam', 'Spam'], ['harassment', 'Harassment or bullying'], ['inappropriate', 'Inappropriate content'], ['impersonation', 'Impersonation'], ['self_harm', 'Self-harm or danger'], ['other', 'Something else']];

export default function ReportForm({ type, targetId, onDone }) {
  const { user } = useAuth();
  const [reason, setReason] = useState('spam');
  const [details, setDetails] = useState('');
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const { error } = await supabase.from('reports').insert({
      reporter_id: user.id, target_type: type, target_id: targetId, reason, details: details.trim() || null,
    });
    if (error) return setMsg(error.code === '23505' ? 'You already reported this.' : friendlyError(error));
    setSent(true);
  }

  if (sent) return <div className="report"><p className="ok">Report sent. Our team will review it.</p><button className="link-btn" onClick={onDone}>Close</button></div>;
  return (
    <form className="report form" onSubmit={submit}>
      <label>Why are you reporting this?
        <select value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </label>
      <label>Details (optional)<textarea rows={2} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} /></label>
      {msg && <p className="error" role="alert">{msg}</p>}
      <div className="row-btns"><button className="btn small-btn">Send report</button><button type="button" className="link-btn" onClick={onDone}>Cancel</button></div>
    </form>
  );
}
