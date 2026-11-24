import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { friendlyChatError } from '../lib/validate';
import Avatar from '../components/Avatar';

export default function NewChat() {
  const nav = useNavigate();
  const [group, setGroup] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState([]);
  const [title, setTitle] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!q.trim()) return setResults([]);
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('search_profiles', { p_q: q, p_limit: 12, p_offset: 0 });
      setResults(data || []);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  async function pick(p) {
    setErr('');
    if (group) return setPicked((o) => (o.find((x) => x.id === p.id) ? o.filter((x) => x.id !== p.id) : [...o, p]));
    setBusy(true);
    const { data, error } = await supabase.rpc('start_dm', { p_user: p.id });
    setBusy(false);
    if (error) return setErr(friendlyChatError(error));
    nav(`/chats/${data}`);
  }
  async function create() {
    if (!title.trim()) return setErr('Give the group a name.');
    if (!picked.length) return setErr('Pick at least one person.');
    setBusy(true); setErr('');
    const { data, error } = await supabase.rpc('create_group', { p_title: title.trim(), p_members: picked.map((x) => x.id) });
    setBusy(false);
    if (error) return setErr(friendlyChatError(error));
    nav(`/chats/${data}`);
  }

  return (
    <div className="page">
      <Link to="/chats" className="small">← Chats</Link>
      <h1>{group ? 'New group' : 'New message'}</h1>
      <div className="chips left"><button className={'chip' + (!group ? ' on' : '')} onClick={() => setGroup(false)}>One to one</button><button className={'chip' + (group ? ' on' : '')} onClick={() => setGroup(true)}>Group</button></div>
      {group && <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder="Group name" aria-label="Group name" />}
      {group && picked.length > 0 && <div className="chips left">{picked.map((p) => <button key={p.id} className="chip on" onClick={() => pick(p)}>@{p.username} ✕</button>)}</div>}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by username" aria-label="Search people" autoCapitalize="none" />
      {err && <p className="error" role="alert">{err}</p>}
      {q.trim() && results.length === 0 && <p className="muted small">No one found.</p>}
      {results.map((p) => (
        <button key={p.id} className="person btnrow" disabled={busy} onClick={() => pick(p)}>
          <Avatar profile={p} size={44} />
          <div className="grow"><div className="nm">{p.display_name}</div><div className="muted small">@{p.username}</div></div>
          {group && <span className="small">{picked.find((x) => x.id === p.id) ? 'Added' : 'Add'}</span>}
        </button>
      ))}
      {group && <button className="btn" onClick={create} disabled={busy}>{busy ? 'Creating…' : 'Create group'}</button>}
      {group && <p className="muted small">Invited people choose whether to join. Groups hold up to 20 people.</p>}
    </div>
  );
}
