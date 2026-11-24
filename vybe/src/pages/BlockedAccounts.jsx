import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';

export default function BlockedAccounts() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    supabase.from('blocked_users')
      .select('blocked_id, blocked:profiles!blocked_users_blocked_id_fkey(username, display_name, avatar_url)')
      .eq('blocker_id', user.id).order('created_at', { ascending: false })
      .then(({ data, error }) => { if (error) setErr('Could not load blocked accounts.'); setRows(data || []); });
  }, [user.id]);

  async function unblock(id) {
    const { error } = await supabase.from('blocked_users').delete().match({ blocker_id: user.id, blocked_id: id });
    if (error) return setErr('Could not unblock. Try again.');
    setRows((o) => o.filter((r) => r.blocked_id !== id));
  }

  return (
    <div className="page">
      <Link to="/settings" className="small">← Settings</Link>
      <h1>Blocked accounts</h1>
      {err && <p className="error" role="alert">{err}</p>}
      {rows === null && <div className="skeleton short" />}
      {rows?.length === 0 && <p className="muted">You have not blocked anyone.</p>}
      {rows?.map((r) => (
        <div className="person" key={r.blocked_id}>
          <Avatar profile={r.blocked} size={44} />
          <div className="grow"><div className="nm">{r.blocked?.display_name}</div><div className="muted small">@{r.blocked?.username}</div></div>
          <button className="btn ghost small-btn" onClick={() => unblock(r.blocked_id)}>Unblock</button>
        </div>
      ))}
    </div>
  );
}
