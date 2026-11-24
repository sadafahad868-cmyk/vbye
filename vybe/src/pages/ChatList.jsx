import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { timeAgo } from '../lib/time';
import Avatar from '../components/Avatar';

const nameOf = (c) => (c.is_group ? c.title : c.display_name) || 'Chat';

export default function ChatList() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('chat_list');
    if (error) setErr('Could not load chats.'); else setRows(data);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel('chatlist:' + user.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members', filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [load, user.id]);

  async function respond(id, accept) {
    const { error } = await supabase.rpc('respond_conversation', { p_cid: id, p_accept: accept });
    if (error) return setErr('Could not do that. Try again.');
    load();
  }
  const invites = rows?.filter((r) => r.status === 'invited') || [];
  const reqs = rows?.filter((r) => r.status === 'request') || [];
  const chats = rows?.filter((r) => r.status === 'active') || [];

  return (
    <div className="page">
      <div className="row"><h1 className="grow">Chats</h1><Link className="btn small-btn" to="/chats/new">New chat</Link></div>
      {err && <p className="error" role="alert">{err}</p>}
      {rows === null && <div className="skeleton short" />}
      {invites.length > 0 && <h2>Group invitations</h2>}
      {invites.map((c) => (
        <div className="person" key={c.id}>
          <Avatar profile={{ display_name: c.title }} size={44} />
          <div className="grow"><div className="nm">{c.title}</div><div className="muted small">Invited you to a group</div></div>
          <button className="btn small-btn" onClick={() => respond(c.id, true)}>Join</button>
          <button className="btn ghost small-btn" onClick={() => respond(c.id, false)}>Decline</button>
        </div>
      ))}
      {reqs.length > 0 && <h2>Message requests</h2>}
      {reqs.map((c) => (
        <div className="person" key={c.id}>
          <Avatar profile={c} size={44} />
          <div className="grow"><div className="nm">{nameOf(c)}</div><div className="muted small clamp">{c.last_message_preview}</div></div>
          <button className="btn small-btn" onClick={() => respond(c.id, true)}>Accept</button>
          <button className="btn ghost small-btn" onClick={() => respond(c.id, false)}>Delete</button>
        </div>
      ))}
      {rows && <h2>Messages</h2>}
      {rows && chats.length === 0 && <div className="empty"><h2>No chats yet</h2><p className="muted">Start one with a friend or create a group.</p></div>}
      {chats.map((c) => (
        <Link className="person" key={c.id} to={`/chats/${c.id}`}>
          <Avatar profile={c.is_group ? { display_name: c.title } : c} size={46} />
          <div className="grow">
            <div className="nm">{nameOf(c)}{c.is_group && <span className="pill tiny">Group</span>}</div>
            <div className="muted small clamp">{c.last_message_preview || 'Say hi'}</div>
          </div>
          <div className="right"><div className="muted small">{timeAgo(c.last_message_at)}</div>{c.unread > 0 && <div className="badge">{c.unread}</div>}</div>
        </Link>
      ))}
    </div>
  );
}
