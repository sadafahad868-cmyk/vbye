import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { timeAgo } from '../lib/time';
import Avatar from '../components/Avatar';

const PAGE = 30;
const WORDS = {
  follow: 'started following you', follow_request: 'asked to follow you', follow_accepted: 'accepted your follow request',
  like: 'liked your post', comment: 'commented on your post', reel_like: 'liked your reel', reel_comment: 'commented on your reel',
  message_request: 'sent you a message request', message: 'sent you a message', group_invite: 'invited you to a group',
};
function target(n) {
  switch (n.type) {
    case 'follow': case 'follow_accepted': return `/u/${n.actor?.username}`;
    case 'follow_request': return '/requests';
    case 'like': case 'comment': return `/post/${n.entity_id}`;
    case 'reel_like': case 'reel_comment': return `/reel/${n.entity_id}`;
    case 'message': return `/chats/${n.entity_id}`;
    default: return '/chats';
  }
}

export default function Notifications() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [more, setMore] = useState(false);
  const [err, setErr] = useState('');

  async function load(before) {
    let q = supabase.from('notifications')
      .select('id, type, entity_id, created_at, read_at, actor:profiles!notifications_actor_id_fkey(username, display_name, avatar_url)')
      .order('created_at', { ascending: false }).limit(PAGE);
    if (before) q = q.lt('created_at', before);
    const { data, error } = await q;
    if (error) return setErr('Could not load notifications.');
    setRows((o) => (before ? [...(o || []), ...data] : data)); setMore(data.length === PAGE);
    if (!before) {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null);
      window.dispatchEvent(new Event('notif-read'));
    }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line

  return (
    <div className="page">
      <div className="row"><h1 className="grow">Notifications</h1><Link className="small" to="/settings">Settings</Link></div>
      {err && <p className="error" role="alert">{err}</p>}
      {rows === null && !err && <div className="skeleton short" />}
      {rows?.length === 0 && <div className="empty"><h2>All quiet</h2><p className="muted">Likes, comments, follows and messages show up here.</p></div>}
      {rows?.map((n) => (
        <Link key={n.id} to={target(n)} className={'person' + (n.read_at ? '' : ' unread')}>
          <Avatar profile={n.actor} size={42} />
          <div className="grow"><div><b>{n.actor?.display_name || 'Someone'}</b> {WORDS[n.type]}</div><div className="muted small">{timeAgo(n.created_at)}</div></div>
        </Link>
      ))}
      {more && <button className="btn ghost" onClick={() => load(rows[rows.length - 1].created_at)}>Load more</button>}
    </div>
  );
}
