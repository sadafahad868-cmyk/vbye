import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { friendlyError } from '../lib/validate';
import { timeAgo } from '../lib/time';
import Avatar from './Avatar';
import ReportForm from './ReportForm';

const PAGE = 15;

export default function Comments({ postId, postOwnerId, onCount, table = 'comments', fk = 'post_id', reportType = 'comment' }) {
  const COLS = `id, body, created_at, author_id, author:profiles!${table}_author_id_fkey(username, display_name, avatar_url)`;
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [state, setState] = useState('loading');
  const [more, setMore] = useState(false);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [reporting, setReporting] = useState(null);

  async function load(before) {
    let q = supabase.from(table).select(COLS).eq(fk, postId).order('created_at', { ascending: false }).limit(PAGE);
    if (before) q = q.lt('created_at', before);
    const { data, error } = await q;
    if (error) return setState('error');
    setItems((o) => (before ? [...o, ...data] : data));
    setMore(data.length === PAGE);
    setState('ready');
  }
  useEffect(() => { load(); }, [postId]); // eslint-disable-line

  async function add(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setErr('');
    const { data, error } = await supabase.from(table).insert({ [fk]: postId, author_id: user.id, body }).select(COLS).single();
    if (error) return setErr(friendlyError(error));
    setItems((o) => [data, ...o]); setText(''); onCount(1);
  }
  async function del(c) {
    const { error } = await supabase.from(table).delete().eq('id', c.id);
    if (error) return setErr(friendlyError(error));
    setItems((o) => o.filter((x) => x.id !== c.id)); onCount(-1);
  }

  return (
    <div className="comments">
      {user && (
        <form className="comment-form" onSubmit={add}>
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Add a comment" aria-label="Add a comment" />
          <button className="btn small-btn" disabled={!text.trim()}>Post</button>
        </form>
      )}
      {err && <p className="error" role="alert">{err}</p>}
      {state === 'loading' && <div className="skeleton short" />}
      {state === 'error' && <p className="error">Could not load comments. <button className="link-btn" onClick={() => load()}>Retry</button></p>}
      {state === 'ready' && items.length === 0 && <p className="muted small">No comments yet. Start the conversation.</p>}
      {items.map((c) => (
        <div className="comment" key={c.id}>
          <Avatar profile={c.author} size={30} />
          <div className="grow">
            <div><Link className="nm" to={`/u/${c.author?.username}`}>{c.author?.display_name}</Link> <span className="muted small">{timeAgo(c.created_at)}</span></div>
            <p>{c.body}</p>
            {user && (
              <div className="muted small">
                {(c.author_id === user.id || postOwnerId === user.id) && <button className="link-btn" onClick={() => del(c)}>Delete</button>}
                {c.author_id !== user.id && <button className="link-btn" onClick={() => setReporting(reporting === c.id ? null : c.id)}>Report</button>}
              </div>
            )}
            {reporting === c.id && <ReportForm type={reportType} targetId={c.id} onDone={() => setReporting(null)} />}
          </div>
        </div>
      ))}
      {more && <button className="link-btn" onClick={() => load(items[items.length - 1].created_at)}>Show more comments</button>}
    </div>
  );
}
