import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { friendlyError } from '../lib/validate';
import { timeAgo } from '../lib/time';
import { APP_NAME } from '../config';
import Avatar from './Avatar';
import Comments from './Comments';
import ReportForm from './ReportForm';

export default function PostCard({ post, onChange, onDelete }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState('');
  const mine = user?.id === post.author_id;

  // Likes and saves update on screen first, then roll back if the database refuses.
  async function toggle(field, table, countField) {
    if (!user) return setNote('Log in to do that.');
    const on = !post[field];
    onChange({ ...post, [field]: on, ...(countField ? { [countField]: Number(post[countField]) + (on ? 1 : -1) } : {}) });
    const row = { post_id: post.id, user_id: user.id };
    const { error } = on ? await supabase.from(table).insert(row) : await supabase.from(table).delete().match(row);
    if (error) { onChange(post); setNote(friendlyError(error)); }
  }
  async function share() {
    const url = `${window.location.origin}/post/${post.id}`;
    if (navigator.share) { try { await navigator.share({ title: `${post.display_name} on ${APP_NAME}`, url }); return; } catch { /* cancelled */ } }
    await navigator.clipboard.writeText(url); setNote('Link copied');
  }
  async function remove() {
    if (!window.confirm('Delete this post?')) return;
    const { error } = await supabase.from('posts').delete().eq('id', post.id);
    if (error) return setNote(friendlyError(error));
    if (post.image_path) await supabase.storage.from('post-images').remove([post.image_path]);
    onDelete(post.id);
  }
  const bump = (d) => onChange({ ...post, comment_count: Number(post.comment_count) + d });

  return (
    <article className="card post">
      <div className="row">
        <Link to={`/u/${post.username}`}><Avatar profile={post} size={40} /></Link>
        <div className="grow">
          <Link className="nm" to={`/u/${post.username}`}>{post.display_name}</Link>
          <div className="muted small">@{post.username} · {timeAgo(post.created_at)}</div>
        </div>
      </div>
      {post.body && <p className="post-body">{post.body}</p>}
      {post.image_url && <img className="post-img" src={post.image_url} alt="" loading="lazy" decoding="async" />}
      <div className="acts">
        <button className={post.liked ? 'on' : ''} onClick={() => toggle('liked', 'post_likes', 'like_count')} aria-pressed={post.liked}>{post.liked ? '♥' : '♡'} {post.like_count}</button>
        <button onClick={() => setOpen(!open)} aria-expanded={open}>Comment {post.comment_count}</button>
        <button onClick={share}>Share</button>
        <button className={post.saved ? 'on' : ''} onClick={() => toggle('saved', 'post_saves')} aria-pressed={post.saved}>{post.saved ? 'Saved' : 'Save'}</button>
        {mine && <button onClick={remove}>Delete</button>}
        {user && !mine && <button onClick={() => setReporting(!reporting)}>Report</button>}
      </div>
      {note && <p className="muted small" role="status">{note}</p>}
      {reporting && <ReportForm type="post" targetId={post.id} onDone={() => setReporting(false)} />}
      {open && <Comments postId={post.id} postOwnerId={post.author_id} onCount={bump} />}
    </article>
  );
}
