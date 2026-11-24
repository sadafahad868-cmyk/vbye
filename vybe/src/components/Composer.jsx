import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { friendlyError } from '../lib/validate';
import { resizeImage } from '../lib/image';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function Composer({ onPosted }) {
  const { user } = useAuth();
  const [body, setBody] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  function pick(e) {
    const f = e.target.files[0];
    if (!f) return;
    if (!TYPES.includes(f.type)) return setErr('Use a JPG, PNG or WebP image.');
    if (f.size > 10 * 1024 * 1024) return setErr('Image must be under 10 MB.');
    setErr(''); setFile(f); setPreview(URL.createObjectURL(f));
  }
  function clear() { setFile(null); setPreview(''); }

  async function submit(e) {
    e.preventDefault();
    const text = body.trim();
    if (!text && !file) return setErr('Write something or add a photo.');
    setBusy(true); setErr('');
    let image_path = null;
    if (file) {
      try {
        const blob = await resizeImage(file);
        if (blob.size > 3 * 1024 * 1024) throw new Error('too big');
        image_path = `${user.id}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from('post-images').upload(image_path, blob, { contentType: 'image/jpeg' });
        if (error) throw error;
      } catch { setBusy(false); return setErr('Could not upload the photo. Try a smaller image.'); }
    }
    const { error } = await supabase.from('posts').insert({ author_id: user.id, body: text || null, image_path });
    if (error) {
      if (image_path) await supabase.storage.from('post-images').remove([image_path]);
      setBusy(false); return setErr(friendlyError(error));
    }
    setBody(''); clear(); setBusy(false); onPosted();
  }

  return (
    <form className="card composer" onSubmit={submit}>
      <textarea rows={2} maxLength={500} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What is your vibe today?" aria-label="New post" />
      {preview && <div className="preview"><img src={preview} alt="Selected" /><button type="button" className="link-btn" onClick={clear}>Remove photo</button></div>}
      {err && <p className="error" role="alert">{err}</p>}
      <div className="row">
        <label className="btn ghost small-btn">Add photo<input type="file" accept={TYPES.join(',')} onChange={pick} hidden /></label>
        <span className="muted small grow">{body.length}/500</span>
        <button className="btn small-btn" disabled={busy}>{busy ? 'Posting…' : 'Post'}</button>
      </div>
    </form>
  );
}
