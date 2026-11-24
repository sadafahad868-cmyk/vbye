import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { CARDS, FONTS, PALETTE, resolveTheme } from '../lib/theme';
import ThemedCard from '../components/ThemedCard';

const FONT_LABEL = { serif: 'Elegant', sans: 'Clean', mono: 'Mono', rounded: 'Friendly' };

export default function ThemeStudio() {
  const { user, profile, refreshProfile } = useAuth();
  const [themes, setThemes] = useState([]);
  const [owned, setOwned] = useState([]);
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState({ t: '', ok: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from('themes').select('*').eq('active', true).neq('kind', 'stickers').order('price_inr').then(({ data }) => setThemes(data || []));
    supabase.from('purchases').select('theme_id').eq('status', 'paid').then(({ data }) => setOwned((data || []).map((x) => x.theme_id)));
  }, []);
  useEffect(() => {
    if (profile) setD({ theme_id: profile.theme?.theme_id || null, bg: profile.theme?.bg || null, ink: profile.theme?.ink || null, font: profile.theme?.font || 'sans', card: profile.theme?.card || 'flat' });
  }, [profile]);
  if (!d || !profile) return <div className="skeleton" />;

  const resolved = resolveTheme(d, themes);
  const locked = (t) => t.is_premium && !owned.includes(t.id);

  async function save() {
    setBusy(true); setMsg({ t: '', ok: false });
    const theme = { font: d.font, card: d.card };
    if (d.theme_id) theme.theme_id = d.theme_id; else { if (d.bg) theme.bg = d.bg; if (d.ink) theme.ink = d.ink; }
    const { error } = await supabase.from('profiles').update({ theme }).eq('id', user.id);
    setBusy(false);
    if (error) return setMsg({ t: error.message.includes('not_owned') ? 'Buy this theme in the Store first.' : 'Could not save. Try again.', ok: false });
    await refreshProfile(); setMsg({ t: 'Saved. Your profile now uses this look.', ok: true });
  }

  return (
    <div className="page">
      <h1>Theme Studio</h1>
      <ThemedCard resolved={resolved} profile={profile} />
      <h2>Themes</h2>
      <div className="swatches">
        {themes.map((t) => (
          <button key={t.id} className={'swatch' + (d.theme_id === t.id ? ' on' : '')} style={{ background: t.config.bg, color: t.config.ink }}
            disabled={locked(t)} onClick={() => setD({ ...d, theme_id: t.id, bg: null, ink: null })} aria-pressed={d.theme_id === t.id}>
            <span>{t.name}</span><small>{t.is_premium ? (locked(t) ? `🔒 ₹${t.price_inr}` : 'Owned') : 'Free'}</small>
          </button>
        ))}
      </div>
      {themes.some(locked) && <Link className="small" to="/store">Unlock premium themes in the Store →</Link>}
      <h2>Custom colors</h2>
      <div className="row">
        <label className="small">Background <input type="color" value={d.bg || '#722F37'} onChange={(e) => setD({ ...d, theme_id: null, bg: e.target.value })} /></label>
        <label className="small">Text <input type="color" value={d.ink || '#FFF1DC'} onChange={(e) => setD({ ...d, theme_id: null, ink: e.target.value, bg: d.bg || '#722F37' })} /></label>
      </div>
      <div className="row">{PALETTE.map((c) => <button key={c} className="dot" style={{ background: c }} aria-label={`Use ${c}`} onClick={() => setD({ ...d, theme_id: null, bg: c, ink: null })} />)}</div>
      <h2>Font</h2>
      <div className="chips left">{Object.keys(FONTS).map((f) => <button key={f} className={'chip' + (d.font === f ? ' on' : '')} style={{ fontFamily: FONTS[f] }} onClick={() => setD({ ...d, font: f })}>{FONT_LABEL[f]}</button>)}</div>
      <h2>Card style</h2>
      <div className="chips left">{CARDS.map((c) => <button key={c} className={'chip' + (d.card === c ? ' on' : '')} onClick={() => setD({ ...d, card: c })}>{c}</button>)}</div>
      {msg.t && <p className={msg.ok ? 'ok' : 'error'} role="status">{msg.t}</p>}
      <button className="btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save to my profile'}</button>
    </div>
  );
}
