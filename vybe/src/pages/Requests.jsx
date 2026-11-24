import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { friendlyError } from '../lib/validate';
import Avatar from '../components/Avatar';

export default function Requests() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    supabase.from('follows')
      .select('follower_id, created_at, follower:profiles!follows_follower_id_fkey(username, display_name, avatar_url)')
      .eq('following_id', user.id).eq('status', 'pending').order('created_at', { ascending: false }).limit(50)
      .then(({ data, error }) => { if (error) setErr('Could not load requests.'); setRows(data || []); });
  }, [user.id]);

  async function act(row, accept) {
    const match = { follower_id: row.follower_id, following_id: user.id };
    const { error } = accept
      ? await supabase.from('follows').update({ status: 'accepted' }).match(match)
      : await supabase.from('follows').delete().match(match);
    if (error) return setErr(friendlyError(error));
    setRows((o) => o.filter((r) => r.follower_id !== row.follower_id));
  }

  return (
    <div className="page">
      <h1>Follow requests</h1>
      <p className="muted small">People ask to follow you when your profile is private. Notifications for new requests arrive in Phase 6.</p>
      {err && <p className="error" role="alert">{err}</p>}
      {rows === null && <div className="skeleton short" />}
      {rows?.length === 0 && <div className="empty"><h2>No pending requests</h2></div>}
      {rows?.map((r) => (
        <div className="person" key={r.follower_id}>
          <Link to={`/u/${r.follower?.username}`}><Avatar profile={r.follower} size={44} /></Link>
          <div className="grow"><div className="nm">{r.follower?.display_name}</div><div className="muted small">@{r.follower?.username}</div></div>
          <button className="btn small-btn" onClick={() => act(r, true)}>Accept</button>
          <button className="btn ghost small-btn" onClick={() => act(r, false)}>Reject</button>
        </div>
      ))}
    </div>
  );
}
