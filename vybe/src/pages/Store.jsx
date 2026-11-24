import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { APP_NAME } from '../config';

const PAYMENTS_ON = import.meta.env.VITE_PAYMENTS_ENABLED === 'true';

function loadCheckout() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve; s.onerror = () => reject(new Error('checkout'));
    document.body.appendChild(s);
  });
}

export default function Store() {
  const [items, setItems] = useState(null);
  const [owned, setOwned] = useState([]);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState({ t: '', ok: false });

  const load = useCallback(async () => {
    const [{ data: t }, { data: p }] = await Promise.all([
      supabase.from('themes').select('*').eq('active', true).eq('is_premium', true).order('price_inr'),
      supabase.from('purchases').select('id, theme_id, amount_inr, status, created_at, theme:themes!purchases_theme_id_fkey(name)').order('created_at', { ascending: false }).limit(30),
    ]);
    setItems(t || []); setHistory(p || []);
    setOwned((p || []).filter((x) => x.status === 'paid').map((x) => x.theme_id));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function buy(t) {
    setMsg({ t: '', ok: false }); setBusy(t.id);
    try {
      const { data, error } = await supabase.functions.invoke('create-order', { body: { theme_id: t.id } });
      if (error || !data?.order_id) throw new Error('order');
      await loadCheckout();
      new window.Razorpay({
        key: data.key_id, order_id: data.order_id, amount: data.amount, currency: 'INR', name: APP_NAME, description: t.name,
        handler: async (resp) => {
          const { error: vErr } = await supabase.functions.invoke('verify-payment', { body: resp });
          setMsg(vErr ? { t: 'We could not verify the payment yet. If money was taken, it will unlock after verification or be refunded.', ok: false } : { t: `${t.name} unlocked.`, ok: true });
          setBusy(''); load();
        },
        modal: { ondismiss: () => setBusy('') },
      }).open();
    } catch { setMsg({ t: 'Could not start the payment. Try again later.', ok: false }); setBusy(''); }
  }

  return (
    <div className="page">
      <h1>{APP_NAME} Store</h1>
      <p className="muted small">Premium looks for your profile. Free themes are in the <Link to="/studio">Theme Studio</Link>.</p>
      {!PAYMENTS_ON && <div className="report"><b>Payments are not set up yet.</b> <span className="small">Buying is switched off until a verified payment provider is connected. Nothing here is simulated.</span></div>}
      {msg.t && <p className={msg.ok ? 'ok' : 'error'} role="status">{msg.t}</p>}
      {items === null && <div className="skeleton" />}
      {items?.map((t) => (
        <div className="card" key={t.id}>
          {t.kind === 'stickers'
            ? <div className="stk-preview">{(t.config.stickers || []).map((s) => <span key={s}>{s}</span>)}</div>
            : <div className="theme-preview" style={{ background: t.config.bg, color: t.config.ink }}>Aa</div>}
          <div className="row" style={{ marginTop: 10 }}>
            <div className="grow"><div className="nm">{t.name}</div><div className="muted small">{t.kind === 'design' ? 'Special profile customization' : t.kind === 'stickers' ? 'Sticker pack for chats' : 'Premium theme pack'}</div></div>
            {owned.includes(t.id)
              ? <Link className="btn ghost small-btn" to={t.kind === 'stickers' ? '/chats' : '/studio'}>{t.kind === 'stickers' ? 'Use in chat' : 'Use'}</Link>
              : <button className="btn small-btn" disabled={!PAYMENTS_ON || busy === t.id} onClick={() => buy(t)}>{busy === t.id ? 'Opening…' : `Buy ₹${t.price_inr}`}</button>}
          </div>
        </div>
      ))}
      <h2>Purchase history</h2>
      {history.length === 0 ? <p className="muted small">No purchases yet.</p> : history.map((h) => (
        <div className="person" key={h.id}><div className="grow"><div className="nm">{h.theme?.name}</div><div className="muted small">{new Date(h.created_at).toLocaleDateString()} · ₹{h.amount_inr}</div></div><span className="pill">{h.status}</span></div>
      ))}
    </div>
  );
}
