import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { timeAgo } from '../lib/time';

export default function Admin() {
  const [ok, setOk] = useState(null);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');

  async function load() {
    const { data: mod } = await supabase.rpc('is_moderator');
    setOk(Boolean(mod));
    if (!mod) return;
    const { data, error } = await supabase.rpc('report_queue');
    if (error) setErr('Could not load reports.'); else setRows(data);
  }
  useEffect(() => { load(); }, []);

  async function act(id, action) {
    const { error } = await supabase.rpc('moderate_report', { p_report: id, p_action: action });
    if (error) return setErr(error.message.includes('cannot_remove_user') ? 'User reports cannot be removed here. Mark reviewed instead.' : 'That did not work. Try again.');
    setErr(''); setRows((o) => o.filter((r) => r.id !== id));
  }
  if (ok === null) return <div className="skeleton short" />;
  if (!ok) return <div className="empty"><h2>Moderators only</h2><p className="muted">This area is for the moderation team.</p></div>;
  return (
    <div className="page">
      <h1>Report queue</h1>
      {err && <p className="error" role="alert">{err}</p>}
      {rows.length === 0 && <div className="empty"><h2>Queue is clear</h2></div>}
      {rows.map((r) => (
        <div className="card" key={r.id}>
          <div className="small muted">{r.target_type} · {r.reason} · by @{r.reporter} · {timeAgo(r.created_at)}</div>
          <p style={{ margin: '8px 0' }}>{r.preview || '[content already removed]'}</p>
          {r.details && <p className="small muted">“{r.details}”</p>}
          <div className="row-btns">
            {r.target_type !== 'user' && <button className="btn small-btn" onClick={() => act(r.id, 'remove')}>Remove content</button>}
            <button className="btn ghost small-btn" onClick={() => act(r.id, 'reviewed')}>Mark reviewed</button>
            <button className="btn ghost small-btn" onClick={() => act(r.id, 'dismiss')}>Dismiss</button>
          </div>
        </div>
      ))}
    </div>
  );
}
