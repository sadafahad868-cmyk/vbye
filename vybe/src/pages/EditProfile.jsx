import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function EditProfile() {
  const { user, profile, refreshProfile } = useAuth();
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    if (profile) setF({
      display_name: profile.display_name || '', bio: profile.bio || '', mood: profile.mood || '',
      interests: (profile.interests || []).join(', '), is_private: profile.is_private, avatar_url: profile.avatar_url,
    });
  }, [profile]);

  if (!f) return <div className="skeleton" />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function pickAvatar(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!TYPES.includes(file.type)) return setMsg('Use a JPG, PNG or WebP image.');
    if (file.size > 2 * 1024 * 1024) return setMsg('Image must be under 2 MB.');
    setBusy(true); setMsg('');
    const path = `${user.id}/avatar-${Date.now()}.${file.type.split('/')[1]}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type });
    if (error) { setBusy(false); return setMsg('Upload failed. Try again.'); }
    setF({ ...f, avatar_url: supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl });
    setBusy(false);
  }

  async function save(e) {
    e.preventDefault();
    const name = f.display_name.trim();
    if (!name) return setMsg('Display name is required.');
    const interests = [...new Set(f.interests.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean))].slice(0, 8);
    if (interests.some((i) => i.length > 20)) return setMsg('Each interest must be 20 characters or fewer.');
    setBusy(true); setMsg('');
    const { error } = await supabase.from('profiles').update({
      display_name: name, bio: f.bio.trim() || null, mood: f.mood.trim() || null,
      interests, is_private: f.is_private, avatar_url: f.avatar_url,
    }).eq('id', user.id);
    setBusy(false);
    if (error) return setMsg('Could not save. Check your inputs and try again.');
    await refreshProfile();
    nav(`/u/${profile.username}`);
  }

  return (
    <form className="form page" onSubmit={save}>
      <h1>Edit profile</h1>
      <div className="avatar-row">
        <Avatar profile={{ ...profile, avatar_url: f.avatar_url }} size={72} />
        <label className="btn ghost small-btn">Change photo<input type="file" accept={TYPES.join(',')} onChange={pickAvatar} hidden /></label>
      </div>
      <label>Display name<input value={f.display_name} onChange={set('display_name')} maxLength={40} /></label>
      <label>Mood or status<input value={f.mood} onChange={set('mood')} maxLength={40} placeholder="Feeling creative" /></label>
      <label>Bio<textarea value={f.bio} onChange={set('bio')} maxLength={160} rows={3} /><small className="hint">{f.bio.length}/160</small></label>
      <label>Interests<input value={f.interests} onChange={set('interests')} placeholder="music, design, travel" /><small className="hint">Comma separated, up to 8.</small></label>
      <label className="switch"><input type="checkbox" checked={f.is_private} onChange={(e) => setF({ ...f, is_private: e.target.checked })} />
        <span>Private profile<small className="hint">People must send a follow request, and only approved followers see your posts.</small></span></label>
      {msg && <p className="error" role="alert">{msg}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      <Link className="links" to={`/u/${profile.username}`}>Cancel</Link>
    </form>
  );
}
