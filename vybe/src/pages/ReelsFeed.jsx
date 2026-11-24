import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { friendlyError } from '../lib/validate';
import { signMany } from '../lib/storage';
import Avatar from '../components/Avatar';
import Comments from '../components/Comments';
import FollowButton from '../components/FollowButton';
import ReportForm from '../components/ReportForm';

const PAGE = 6;

function Caption({ text }) {
  if (!text) return null;
  return <p className="reel-cap">{text.split(/(#[a-z0-9_]{2,30})/gi).map((part, i) => (
    part.startsWith('#') ? <Link key={i} to={`/tag/${part.slice(1).toLowerCase()}`}>{part}</Link> : part))}</p>;
}

function ReelItem({ r, thumb, active, index, muted, setMuted, onVisible, onChange, onDelete }) {
  const { user } = useAuth();
  const box = useRef(null);
  const vid = useRef(null);
  const [src, setSrc] = useState(null);
  const [paused, setPaused] = useState(false);
  const [cm, setCm] = useState(false);
  const [rep, setRep] = useState(false);
  const [note, setNote] = useState('');
  const mine = user?.id === r.author_id;

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) onVisible(index); }, { threshold: 0.7 });
    io.observe(box.current);
    return () => io.disconnect();
  }, [index, onVisible]);

  // Only the reel on screen downloads its video. The others show a thumbnail.
  useEffect(() => {
    if (!active) { setSrc(null); setPaused(false); return undefined; }
    let ok = true;
    supabase.storage.from('reels').createSignedUrl(r.video_path, 3600).then(({ data }) => { if (ok && data) setSrc(data.signedUrl); });
    return () => { ok = false; };
  }, [active, r.video_path]);
  useEffect(() => { if (vid.current) vid.current.muted = muted; }, [muted, src]);

  function toggle() {
    const v = vid.current;
    if (!v) return;
    if (v.paused) { v.play(); setPaused(false); } else { v.pause(); setPaused(true); }
  }
  async function flip(field, table, counter) {
    if (!user) return setNote('Log in to do that.');
    const on = !r[field];
    onChange({ ...r, [field]: on, ...(counter ? { [counter]: Number(r[counter]) + (on ? 1 : -1) } : {}) });
    const row = { reel_id: r.id, user_id: user.id };
    const { error } = on ? await supabase.from(table).insert(row) : await supabase.from(table).delete().match(row);
    if (error) { onChange(r); setNote(friendlyError(error)); }
  }
  async function share() {
    const url = `${window.location.origin}/reel/${r.id}`;
    if (navigator.share) { try { await navigator.share({ url }); return; } catch { /* cancelled */ } }
    await navigator.clipboard.writeText(url); setNote('Link copied');
  }
  async function remove() {
    if (!window.confirm('Delete this reel?')) return;
    const { error } = await supabase.from('reels').delete().eq('id', r.id);
    if (error) return setNote(friendlyError(error));
    await supabase.storage.from('reels').remove([r.video_path, r.thumb_path].filter(Boolean));
    onDelete(r.id);
  }

  return (
    <div className="reel" ref={box}>
      {src ? (
        <video ref={vid} src={src} poster={thumb} autoPlay loop muted playsInline preload="auto" onClick={toggle} />
      ) : (
        <div className="reel-poster" style={thumb ? { backgroundImage: `url(${thumb})` } : undefined} />
      )}
      {paused && <div className="reel-pause" aria-hidden="true">▶</div>}
      <button className="reel-sound" onClick={() => setMuted(!muted)} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}>{muted ? '🔇 Sound off' : '🔊 Sound on'}</button>
      <div className="reel-side">
        <button onClick={() => flip('liked', 'reel_likes', 'like_count')} aria-pressed={r.liked}><span>{r.liked ? '♥' : '♡'}</span>{r.like_count}</button>
        <button onClick={() => setCm(true)}><span>💬</span>{r.comment_count}</button>
        <button onClick={share}><span>↗</span>Share</button>
        <button onClick={() => flip('saved', 'reel_saves')} aria-pressed={r.saved}><span>{r.saved ? '🔖' : '📑'}</span>{r.saved ? 'Saved' : 'Save'}</button>
        {mine ? <button onClick={remove}><span>🗑</span>Delete</button> : user && <button onClick={() => setRep(true)}><span>⚑</span>Report</button>}
      </div>
      <div className="reel-info">
        <div className="row">
          <Link to={`/u/${r.username}`}><Avatar profile={r} size={34} /></Link>
          <Link className="nm" to={`/u/${r.username}`}>@{r.username}</Link>
          <FollowButton targetId={r.author_id} status={r.follow_status} onChange={(s) => onChange({ ...r, follow_status: s })} />
        </div>
        <Caption text={r.caption} />
        {note && <p className="small" role="status">{note}</p>}
      </div>
      {cm && (
        <div className="sheet" role="dialog" aria-label="Comments">
          <button className="link-btn" onClick={() => setCm(false)}>Close</button>
          <Comments postId={r.id} postOwnerId={r.author_id} table="reel_comments" fk="reel_id" reportType="reel_comment"
            onCount={(d) => onChange({ ...r, comment_count: Number(r.comment_count) + d })} />
        </div>
      )}
      {rep && <div className="sheet" role="dialog" aria-label="Report"><ReportForm type="reel" targetId={r.id} onDone={() => setRep(false)} /></div>}
    </div>
  );
}

export default function ReelsFeed({ mode = 'feed', author = null, tag = null, reel = null }) {
  const [items, setItems] = useState([]);
  const [thumbs, setThumbs] = useState({});
  const [state, setState] = useState('loading');
  const [more, setMore] = useState(false);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true); // sound starts off; only the person turns it on
  const loading = useRef(false);

  const load = useCallback(async (before) => {
    loading.current = true;
    const { data, error } = await supabase.rpc('get_reels', { p_mode: mode, p_author: author, p_tag: tag, p_reel: reel, p_before: before ?? null, p_limit: PAGE });
    loading.current = false;
    if (error) return setState('error');
    const t = await signMany('reels', data.map((x) => x.thumb_path));
    setThumbs((o) => ({ ...o, ...t }));
    setItems((o) => (before ? [...o, ...data] : data));
    setMore(data.length === PAGE);
    setState('ready');
  }, [mode, author, tag, reel]);

  useEffect(() => { setState('loading'); setItems([]); setActive(0); load(null); }, [load]);
  useEffect(() => {
    if (more && !loading.current && items.length && active >= items.length - 2) load(items[items.length - 1].created_at);
  }, [active]); // eslint-disable-line
  const onVisible = useCallback((i) => setActive(i), []);

  if (state === 'loading') return <div className="reels"><div className="reel skeleton" aria-busy="true" /></div>;
  if (state === 'error') return <div className="empty"><p className="error">Could not load reels.</p><button className="btn ghost" onClick={() => load(null)}>Try again</button></div>;
  return (
    <div className="reels-wrap">
      {tag && <div className="reels-title">#{tag}</div>}
      <Link className="btn small-btn reel-new" to="/reels/new">Upload</Link>
      {items.length === 0 ? (
        <div className="empty"><div className="empty-mark" aria-hidden="true">◌</div><h2>No reels yet</h2><p className="muted">Be the first to share one.</p><Link className="btn" to="/reels/new">Upload a reel</Link></div>
      ) : (
        <div className="reels">
          {items.map((r, i) => (
            <ReelItem key={r.id} r={r} thumb={thumbs[r.thumb_path]} index={i} active={i === active} muted={muted} setMuted={setMuted}
              onVisible={onVisible} onChange={(nr) => setItems((o) => o.map((x) => (x.id === nr.id ? nr : x)))}
              onDelete={(id) => setItems((o) => o.filter((x) => x.id !== id))} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TagReels() { const { tag } = useParams(); return <ReelsFeed mode="tag" tag={tag.toLowerCase()} />; }
export function SingleReel() { const { id } = useParams(); return <ReelsFeed mode="single" reel={id} />; }
