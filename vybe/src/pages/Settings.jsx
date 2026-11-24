import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { friendlyAuthError, validatePassword } from '../lib/validate';
import { removeMyFiles } from '../lib/storage';

const NOTIFS = [['follows', 'New followers'], ['requests', 'Friend and follow requests'], ['likes', 'Likes'], ['comments', 'Comments'], ['messages', 'Messages and message requests'], ['groups', 'Group invitations']];

export default function Settings() {
  const { user, profile, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [pw, setPw] = useState('');
  const [pwMsg, setPwMsg] = useState({ t: '', ok: false });
  const [confirm, setConfirm] = useState('');
  const [delErr, setDelErr] = useState('');
  const [note, setNote] = useState('');
  const [isMod, setIsMod] = useState(false);
  useEffect(() => { supabase.rpc('is_moderator').then(({ data }) => setIsMod(Boolean(data))); }, []);
  if (!profile) return <div className="skeleton" />;

  async function save(patch) {
    setNote('');
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
    if (error) return setNote('Could not save that setting.');
    await refreshProfile(); setNote('Saved');
  }
  function toggleTheme() {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch { /* ignore */ }
  }
  async function changePw(e) {
    e.preventDefault();
    const v = validatePassword(pw);
    if (v) return setPwMsg({ t: v, ok: false });
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return setPwMsg({ t: friendlyAuthError(error), ok: false });
    setPw(''); setPwMsg({ t: 'Password updated.', ok: true });
  }
  async function logout() { await supabase.auth.signOut(); nav('/login', { replace: true }); }
  async function deleteAccount() {
    setDelErr('');
    try { await removeMyFiles(user.id); } catch { /* files are best effort */ }
    const { error } = await supabase.rpc('delete_my_account');
    if (error) return setDelErr('Could not delete the account. Try again.');
    await supabase.auth.signOut(); nav('/signup', { replace: true });
  }
  const prefs = profile.notif_prefs || {};

  return (
    <div className="page">
      <h1>Settings</h1>
      {note && <p className="muted small" role="status">{note}</p>}
      <div className="group">
        <h2>Account</h2>
        <Link to="/profile/edit">Edit profile</Link><Link to="/studio">Theme Studio</Link><Link to="/store">Store and purchases</Link>
        <Link to="/saved">Saved posts</Link>{isMod && <Link to="/admin">Moderation queue</Link>}
        <button className="link-btn" onClick={toggleTheme}>Switch light or dark theme</button>
      </div>
      <div className="group">
        <h2>Privacy</h2>
        <label className="switch"><input type="checkbox" checked={profile.is_private} onChange={(e) => save({ is_private: e.target.checked })} /><span>Private profile<small className="hint">Only approved followers see your posts and reels.</small></span></label>
        <label className="form">Who can message you
          <select value={profile.message_policy} onChange={(e) => save({ message_policy: e.target.value })}>
            <option value="everyone">Everyone (new people send a request)</option>
            <option value="following">Only people I follow</option>
            <option value="nobody">Nobody</option>
          </select>
        </label>
        <label className="switch"><input type="checkbox" checked={profile.show_online} onChange={(e) => save({ show_online: e.target.checked })} /><span>Show when I am online<small className="hint">Visible only inside chats.</small></span></label>
        <Link to="/settings/blocked">Blocked accounts</Link>
      </div>
      <div className="group">
        <h2>Notifications</h2>
        {NOTIFS.map(([k, label]) => (
          <label className="switch" key={k}><input type="checkbox" checked={prefs[k] !== false} onChange={(e) => save({ notif_prefs: { ...prefs, [k]: e.target.checked } })} /><span>{label}</span></label>
        ))}
      </div>
      <form className="form group" onSubmit={changePw}>
        <h2>Change password</h2>
        <label>New password<input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        {pwMsg.t && <p className={pwMsg.ok ? 'ok' : 'error'} role="alert">{pwMsg.t}</p>}
        <button className="btn ghost">Update password</button>
      </form>
      <div className="group"><h2>Safety</h2><p className="muted small">To report something, tap Report on any post, reel, comment, profile or chat. Reports go to our moderators.</p></div>
      <button className="btn ghost" onClick={logout}>Log out</button>
      <div className="group danger">
        <h2>Delete account</h2>
        <p className="muted small">This permanently removes your account, posts, reels and uploaded photos. Type your username to confirm.</p>
        <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={profile.username} aria-label="Confirm username" />
        {delErr && <p className="error" role="alert">{delErr}</p>}
        <button className="btn danger-btn" disabled={confirm !== profile.username} onClick={deleteAccount}>Delete my account</button>
      </div>
    </div>
  );
}
