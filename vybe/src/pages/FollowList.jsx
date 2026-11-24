import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Avatar from '../components/Avatar';

const PAGE = 30;

export default function FollowList({ kind }) {
  const { username } = useParams();
  const [owner, setOwner] = useState(undefined);
  const [rows, setRows] = useState([]);
  const [more, setMore] = useState(false);
  const [state, setState] = useState('loading');

  async function load(offset, id) {
    const { data, error } = await supabase.rpc('follow_list', { p_user: id, p_kind: kind, p_limit: PAGE, p_offset: offset });
    if (error) return setState('error');
    setRows((o) => (offset ? [...o, ...data] : data));
    setMore(data.length === PAGE); setState('ready');
  }
  useEffect(() => {
    setOwner(undefined); setRows([]); setState('loading');
    supabase.from('profiles').select('id, username, display_name').eq('username', username.toLowerCase()).maybeSingle()
      .then(({ data }) => { setOwner(data); if (data) load(0, data.id); else setState('ready'); });
  }, [username, kind]); // eslint-disable-line

  if (owner === null) return <div className="empty"><h2>Profile unavailable</h2></div>;
  return (
    <div className="page">
      <Link to={`/u/${username}`} className="small">← @{username}</Link>
      <h1>{kind === 'followers' ? 'Followers' : 'Following'}</h1>
      {state === 'loading' && <div className="skeleton short" />}
      {state === 'error' && <p className="error">Could not load this list. Try again.</p>}
      {state === 'ready' && rows.length === 0 && <p className="muted">Nobody to show here yet. If the account is private, you need to follow it first.</p>}
      {rows.map((r) => (
        <Link key={r.id} className="person" to={`/u/${r.username}`}>
          <Avatar profile={r} size={44} />
          <div><div className="nm">{r.display_name}</div><div className="muted small">@{r.username}</div></div>
        </Link>
      ))}
      {more && <button className="btn ghost" onClick={() => load(rows.length, owner.id)}>Load more</button>}
    </div>
  );
}
