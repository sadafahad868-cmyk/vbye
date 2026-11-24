import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { friendlyError } from '../lib/validate';
import { extractHashtags, probeVideo } from '../lib/video';

const TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export default function ReelUpload() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [file, setFile] = useState(null);
  const [info, setInfo] = useState(null);
  const [preview, setPreview] = useState('');
  const [caption, setCaption] = useState('');
  const [own, setOwn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function pick(e) {
    const f = e.target.files[0];
    if (!f) return;
    setErr(''); setInfo(null); setFile(null); setPreview('');
    if (!TYPES.includes(f.type)) return setErr('Use an MP4, WebM or MOV video.');
    if (f.size > 50 * 1024 * 1024) return setErr('Video must be under 50 MB. See the tips below to shrink it.');
    try {
      const i = await probeVideo(f);
      if (i.duration > 60) return setErr('Reels can be up to 60 seconds.');
      setFile(f); setInfo(i); setPreview(URL.createObjectURL(i.thumb));
    } catch { setErr('Could not read that video. Try an MP4 (H.264).'); }
  }
  async function submit(e) {
    e.preventDefault();
    if (!file || !info) return setErr('Choose a video first.');
    if (!own) return setErr('Confirm that you own the rights to this video and its music.');
    setBusy(true); setErr('');
    const base = `${user.id}/${crypto.randomUUID()}`;
    const ext = file.type === 'video/webm' ? 'webm' : file.type === 'video/quicktime' ? 'mov' : 'mp4';
    const vpath = `${base}.${ext}`; const tpath = `${base}.jpg`;
    const up = await supabase.storage.from('reels').upload(vpath, file, { contentType: file.type });
    if (up.error) { setBusy(false); return setErr('Upload failed. Check your connection and try again.'); }
    const th = await supabase.storage.from('reels').upload(tpath, info.thumb, { contentType: 'image/jpeg' });
    const { error } = await supabase.from('reels').insert({
      author_id: user.id, video_path: vpath, thumb_path: th.error ? null : tpath,
      caption: caption.trim() || null, hashtags: extractHashtags(caption),
    });
    if (error) { await supabase.storage.from('reels').remove([vpath, tpath]); setBusy(false); return setErr(friendlyError(error)); }
    nav('/reels');
  }

  return (
    <form className="form page" onSubmit={submit}>
      <Link to="/reels" className="small">← Reels</Link>
      <h1>New reel</h1>
      <label className="btn ghost">{file ? 'Choose a different video' : 'Choose a video'}<input type="file" accept={TYPES.join(',')} onChange={pick} hidden /></label>
      {preview && <div className="preview"><img src={preview} alt="Video thumbnail" /><span className="muted small">{Math.round(info.duration)}s · {(file.size / 1048576).toFixed(1)} MB</span></div>}
      <label>Caption<textarea rows={2} maxLength={150} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Say something. Add #hashtags (up to 5)" /><small className="hint">{caption.length}/150</small></label>
      <label className="switch"><input type="checkbox" checked={own} onChange={(e) => setOwn(e.target.checked)} />
        <span>I own this video, or have permission to share it, including any music in it.</span></label>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Uploading… keep this page open' : 'Share reel'}</button>
      <div className="group small muted">
        <b>Tips for smaller, faster videos</b>
        <span>Vertical (9:16), 720p to 1080p, up to 60 seconds, H.264 MP4. Limit is 50 MB. If yours is bigger, compress it with HandBrake (Web Optimized preset) or choose Medium quality when sharing from your phone.</span>
        <span>VYBE does not provide music. Use only your own sound or music you are licensed to use.</span>
      </div>
    </form>
  );
}
