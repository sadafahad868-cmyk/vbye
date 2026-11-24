import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { friendlyChatError, friendlyError } from '../lib/validate';
import { signMany } from '../lib/storage';
import { resolveTheme } from '../lib/theme';
import FollowButton from '../components/FollowButton';
import PostList from '../components/PostList';
import ReportForm from '../components/ReportForm';
import ThemedCard from '../components/ThemedCard';
import { Splash } from '../components/Guards';

export function MyProfileRedirect() {
  const { profile, loading } = useAuth();
  if (loading) return <Splash />;
  return profile ? <Navigate to={`/u/${profile.username}`} replace /> : <p className="muted pad">Profile not found.</p>;
}

function ReelGrid({ author, mine }) {
  const [rows, setRows] = useState(null);
  const [thumbs, setThumbs] = useState({});
  useEffect(() => {
    supabase.rpc('get_reels', { p_mode: 'user', p_author: author, p_limit: 18 }).then(async ({ data }) => {
      setRows(data || []); setThumbs(await signMany('reels', (data || []).map((r) => r.thumb_path)));
    });
  }, [author]);
  if (rows === null) return <div className="skeleton short" />;
  if (!rows.length) return <div className="empty"><h2>No reels yet</h2>{mine && <Link className="btn" to="/reels/new">Upload a reel</Link>}</div>;
  return <div className="grid">{rows.map((r) => <Link key={r.id} to={`/reel/${r.id}`} className="tile" style={thumbs[r.thumb_path] ? { backgroundImage: `url(${thumbs[r.thumb_path]})` } : undefined} aria-label={r.caption || 'Reel'} />)}</div>;
}

export default function Profile() {
  const { username } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [p, setP] = useState(undefined);
  const [stats, setStats] = useState(null);
  const [themes, setThemes] = useState([]);
  const [tab, setTab] = useState('posts');
  const [copied, setCopied] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [err, setErr] = useState('');

  const loadStats = useCallback(async (id) => { const { data } = await supabase.rpc('profile_stats', { p_user: id }); setStats(data); }, []);
  useEffect(() => {
    setP(undefined); setStats(null); setTab('posts');
    supabase.from('profiles').select('*').eq('username', username.toLowerCase()).maybeSingle()
      .then(({ data }) => { setP(data); if (data) loadStats(data.id); });
  }, [username, loadStats]);
  useEffect(() => { supabase.from('themes').select('id, config').eq('active', true).then(({ data }) => setThemes(data || [])); }, []);

  if (p === undefined) return <div className="skeleton" aria-busy="true" />;
  if (!p) return <div className="empty"><h2>Profile unavailable</h2><p className="muted">This profile does not exist or is not available to you.</p></div>;

  const mine = user?.id === p.id;
  const url = `${window.location.origin}/u/${p.username}`;
  async function share() {
    if (navigator.share) { try { await navigator.share({ title: p.display_name, url }); return; } catch { /* cancelled */ } }
    await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800);
  }
  async function block() {
    if (!window.confirm(`Block @${p.username}? You will stop following each other and cannot see each other's posts.`)) return;
    const { error } = await supabase.rpc('block_user', { p_target: p.id });
    if (error) return setErr(friendlyError(error));
    loadStats(p.id);
  }
  async function unblock() {
    const { error } = await supabase.from('blocked_users').delete().match({ blocker_id: user.id, blocked_id: p.id });
    if (error) return setErr(friendlyError(error));
    loadStats(p.id);
  }
  async function message() {
    setErr('');
    const { data, error } = await supabase.rpc('start_dm', { p_user: p.id });
    if (error) return setErr(friendlyChatError(error));
    nav(`/chats/${data}`);
  }
  const n = (v) => (v == null ? '–' : v);
  const canSee = stats?.can_view && !stats?.blocked_by_me;

  return (
    <section className="profile">
      <ThemedCard resolved={resolveTheme(p.theme, themes)} profile={p}>
        <p className="muted small">{p.is_private ? 'Private · ' : ''}{stats?.follows_me ? 'Follows you' : ''}</p>
        {p.interests?.length > 0 && <div className="chips">{p.interests.map((i) => <span key={i} className="chip">{i}</span>)}</div>}
        <div className="stats">
          <div><b>{n(stats?.posts)}</b>Posts</div>
          <Link to={`/u/${p.username}/followers`}><b>{n(stats?.followers)}</b>Followers</Link>
          <Link to={`/u/${p.username}/following`}><b>{n(stats?.following)}</b>Following</Link>
        </div>
      </ThemedCard>
      <div className="row-btns">
        {mine && <Link className="btn ghost" to="/profile/edit">Edit profile</Link>}
        {!mine && stats && !stats.blocked_by_me && <FollowButton targetId={p.id} status={stats.follow_status} onChange={() => loadStats(p.id)} />}
        {!mine && user && stats && !stats.blocked_by_me && <button className="btn ghost" onClick={message}>Message</button>}
        {!mine && stats?.blocked_by_me && <button className="btn ghost" onClick={unblock}>Unblock</button>}
        {!mine && !user && <Link className="btn" to="/login">Log in to follow</Link>}
        <button className="btn ghost" onClick={share}>{copied ? 'Link copied' : 'Share profile'}</button>
      </div>
      {user && !mine && !stats?.blocked_by_me && (
        <div className="muted small"><button className="link-btn" onClick={block}>Block</button> · <button className="link-btn" onClick={() => setReporting(!reporting)}>Report</button></div>
      )}
      {err && <p className="error" role="alert">{err}</p>}
      {reporting && <ReportForm type="user" targetId={p.id} onDone={() => setReporting(false)} />}
      <div className="tabs2" role="tablist">
        <button role="tab" aria-selected={tab === 'posts'} className={tab === 'posts' ? 'on' : ''} onClick={() => setTab('posts')}>Posts</button>
        <button role="tab" aria-selected={tab === 'reels'} className={tab === 'reels' ? 'on' : ''} onClick={() => setTab('reels')}>Reels</button>
      </div>
      <div className="profile-posts">
        {stats?.blocked_by_me ? <p className="muted center">You blocked this account.</p>
          : stats && !canSee ? <div className="empty"><h2>This account is private</h2><p className="muted">Follow @{p.username} to see their posts and reels. They need to approve your request.</p></div>
          : stats && tab === 'posts' ? <PostList mode="user" author={p.id} empty={<div className="empty"><h2>No posts yet</h2><p className="muted">{mine ? 'Share your first post from Home.' : 'Nothing here yet.'}</p></div>} />
          : stats && <ReelGrid author={p.id} mine={mine} />}
      </div>
    </section>
  );
}
