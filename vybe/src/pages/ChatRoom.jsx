import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { friendlyChatError } from '../lib/validate';
import { resizeImage } from '../lib/image';
import { signMany } from '../lib/storage';
import Avatar from '../components/Avatar';
import ReportForm from '../components/ReportForm';

const EMOJI = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const COLS = 'id, sender_id, body, image_path, reply_to, created_at, reactions:message_reactions(user_id, emoji)';
const PAGE = 30;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function ChatRoom() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const [key, setKey] = useState(0);
  const [conv, setConv] = useState(null);
  const [members, setMembers] = useState([]);
  const [msgs, setMsgs] = useState([]);
  const [urls, setUrls] = useState({});
  const [more, setMore] = useState(false);
  const [state, setState] = useState('loading'); // loading | ready | pending | missing | error
  const [text, setText] = useState('');
  const [reply, setReply] = useState(null);
  const [err, setErr] = useState('');
  const [typing, setTyping] = useState({});
  const [online, setOnline] = useState([]);
  const [pickFor, setPickFor] = useState(null);
  const [stickers, setStickers] = useState([]);
  const [showStk, setShowStk] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const bottom = useRef(null);
  const chan = useRef(null);
  const lastTyping = useRef(0);
  const ids = useRef(new Set());
  const skipScroll = useRef(false);

  async function loadMsgs(before) {
    let q = supabase.from('messages').select(COLS).eq('conversation_id', id).order('created_at', { ascending: false }).limit(PAGE);
    if (before) q = q.lt('created_at', before);
    const { data, error } = await q;
    if (error) return setState('error');
    const count = data.length;
    const rows = [...data].reverse();
    rows.forEach((r) => ids.current.add(r.id));
    const u = await signMany('chat-images', rows.map((r) => r.image_path));
    setUrls((o) => ({ ...o, ...u }));
    skipScroll.current = Boolean(before);
    setMsgs((o) => (before ? [...rows, ...o] : rows));
    setMore(count === PAGE);
    setState('ready');
  }

  useEffect(() => {
    ids.current = new Set(); setState('loading'); setMsgs([]);
    (async () => {
      const [{ data: c }, { data: m }] = await Promise.all([
        supabase.from('conversations').select('id, is_group, title').eq('id', id).maybeSingle(),
        supabase.from('conversation_members')
          .select('user_id, role, status, profile:profiles!conversation_members_user_id_fkey(username, display_name, avatar_url)')
          .eq('conversation_id', id),
      ]);
      if (!c) return setState('missing');
      setConv(c); setMembers(m || []);
      const mine = (m || []).find((x) => x.user_id === user.id);
      if (!mine || mine.status !== 'active') return setState('pending');
      await loadMsgs(null);
      supabase.rpc('mark_read', { p_cid: id });
    })();
  }, [id, key]); // eslint-disable-line

  useEffect(() => {
    supabase.from('purchases').select('theme:themes!purchases_theme_id_fkey(config, kind)').eq('status', 'paid')
      .then(({ data }) => setStickers((data || []).filter((x) => x.theme?.kind === 'stickers').flatMap((x) => x.theme.config.stickers || [])));
  }, []);

  // Live messages, reactions, typing and (optional) online status.
  useEffect(() => {
    if (state !== 'ready') return;
    const ch = supabase.channel('room:' + id, { config: { presence: { key: user.id }, broadcast: { self: false } } });
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, async ({ new: r }) => {
        if (ids.current.has(r.id)) return;
        ids.current.add(r.id);
        if (r.image_path) { const u = await signMany('chat-images', [r.image_path]); setUrls((o) => ({ ...o, ...u })); }
        skipScroll.current = false;
        setMsgs((o) => [...o, { ...r, reactions: [] }]);
        if (r.sender_id !== user.id) supabase.rpc('mark_read', { p_cid: id });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, ({ old }) => setMsgs((o) => o.filter((m) => m.id !== old.id)))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' }, ({ new: r }) =>
        setMsgs((o) => o.map((m) => (m.id === r.message_id && !m.reactions.some((x) => x.user_id === r.user_id && x.emoji === r.emoji)
          ? { ...m, reactions: [...m.reactions, { user_id: r.user_id, emoji: r.emoji }] } : m))))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, ({ old }) =>
        setMsgs((o) => o.map((m) => (m.id === old.message_id
          ? { ...m, reactions: m.reactions.filter((x) => !(x.user_id === old.user_id && x.emoji === old.emoji)) } : m))))
      .on('broadcast', { event: 'typing' }, ({ payload }) => setTyping((o) => ({ ...o, [payload.uid]: Date.now() + 3000 })))
      .on('presence', { event: 'sync' }, () => setOnline(Object.keys(ch.presenceState())))
      .subscribe(async (status) => { if (status === 'SUBSCRIBED' && profile?.show_online) await ch.track({ at: Date.now() }); });
    chan.current = ch;
    return () => { supabase.removeChannel(ch); chan.current = null; };
  }, [state, id]); // eslint-disable-line

  useEffect(() => {
    const t = setInterval(() => setTyping((o) => {
      const now = Date.now(); const keep = Object.keys(o).filter((u) => o[u] > now);
      return keep.length === Object.keys(o).length ? o : Object.fromEntries(keep.map((u) => [u, o[u]]));
    }), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { if (!skipScroll.current) bottom.current?.scrollIntoView({ block: 'end' }); }, [msgs.length]);

  function onType(e) {
    setText(e.target.value);
    const now = Date.now();
    if (chan.current && now - lastTyping.current > 1500) {
      lastTyping.current = now;
      chan.current.send({ type: 'broadcast', event: 'typing', payload: { uid: user.id } });
    }
  }
  async function send(body, image_path = null) {
    const row = { conversation_id: id, sender_id: user.id, body: body || null, image_path, reply_to: reply?.id || null };
    const { data, error } = await supabase.from('messages').insert(row).select(COLS).single();
    if (error) { setErr(friendlyChatError(error)); return false; }
    ids.current.add(data.id); skipScroll.current = false;
    setMsgs((o) => (o.some((m) => m.id === data.id) ? o : [...o, data]));
    setReply(null);
    return true;
  }
  async function submit(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setErr(''); setText('');
    if (!(await send(t))) setText(t);
  }
  async function photo(e) {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (!TYPES.includes(f.type)) return setErr('Use a JPG, PNG or WebP image.');
    if (f.size > 10 * 1024 * 1024) return setErr('Image must be under 10 MB.');
    setErr('');
    try {
      const blob = await resizeImage(f);
      if (blob.size > 3 * 1024 * 1024) throw new Error('big');
      const path = `${id}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from('chat-images').upload(path, blob, { contentType: 'image/jpeg' });
      if (error) throw error;
      const u = await signMany('chat-images', [path]);
      setUrls((o) => ({ ...o, ...u }));
      await send(null, path);
    } catch { setErr('Could not send the photo. Try a smaller image.'); }
  }
  async function react(m, emoji) {
    setPickFor(null);
    const had = m.reactions.some((r) => r.user_id === user.id && r.emoji === emoji);
    setMsgs((o) => o.map((x) => (x.id === m.id ? { ...x, reactions: had
      ? x.reactions.filter((r) => !(r.user_id === user.id && r.emoji === emoji)) : [...x.reactions, { user_id: user.id, emoji }] } : x)));
    const row = { message_id: m.id, user_id: user.id, emoji };
    const { error } = had ? await supabase.from('message_reactions').delete().match(row) : await supabase.from('message_reactions').insert(row);
    if (error) setErr('Could not react. Try again.');
  }
  async function unsend(m) {
    const { error } = await supabase.from('messages').delete().eq('id', m.id);
    if (error) return setErr('Could not delete the message.');
    setMsgs((o) => o.filter((x) => x.id !== m.id));
  }
  async function respond(accept) {
    const { error } = await supabase.rpc('respond_conversation', { p_cid: id, p_accept: accept });
    if (error) return setErr('Could not do that. Try again.');
    if (accept) setKey((k) => k + 1); else nav('/chats');
  }
  async function leave() {
    if (!window.confirm('Leave this group?')) return;
    await supabase.from('conversation_members').delete().match({ conversation_id: id, user_id: user.id });
    nav('/chats');
  }
  async function blockOther(uid) {
    if (!window.confirm('Block this person? You will stop following each other and cannot message.')) return;
    const { error } = await supabase.rpc('block_user', { p_target: uid });
    if (error) return setErr('Could not block. Try again.');
    nav('/chats');
  }

  if (state === 'loading') return <div className="skeleton" aria-busy="true" />;
  if (state === 'missing' || state === 'error') return <div className="empty"><h2>Chat unavailable</h2><p className="muted">It may not exist or you are not part of it.</p><Link to="/chats" className="btn ghost">Back to chats</Link></div>;
  if (state === 'pending') return (
    <div className="empty">
      <h2>{conv.is_group ? `Invitation to ${conv.title}` : 'Message request'}</h2>
      <p className="muted">{conv.is_group ? 'Join to see and send messages.' : 'Accept to read the messages and reply.'}</p>
      {err && <p className="error">{err}</p>}
      <div className="row-btns"><button className="btn" onClick={() => respond(true)}>Accept</button><button className="btn ghost" onClick={() => respond(false)}>Decline</button></div>
    </div>
  );

  const other = members.find((m) => m.user_id !== user.id);
  const title = conv.is_group ? conv.title : other?.profile?.display_name || 'Chat';
  const typers = Object.keys(typing).filter((u) => u !== user.id).map((u) => members.find((m) => m.user_id === u)?.profile?.display_name || 'Someone');
  const otherOnline = !conv.is_group && other && online.includes(other.user_id);

  return (
    <div className="room">
      <div className="room-head row">
        <Link to="/chats" aria-label="Back">←</Link>
        <Avatar profile={conv.is_group ? { display_name: title } : other?.profile} size={38} />
        <div className="grow"><div className="nm">{title}</div>
          <div className="muted small">{conv.is_group ? `${members.filter((m) => m.status === 'active').length} members` : otherOnline ? 'Online' : ''}</div></div>
        <button className="link-btn" onClick={() => setMenu(!menu)} aria-expanded={menu}>⋯</button>
      </div>
      {menu && (
        <div className="report">
          {conv.is_group ? <button className="link-btn" onClick={leave}>Leave group</button> : (
            <>
              <button className="link-btn" onClick={() => blockOther(other.user_id)}>Block {other?.profile?.display_name}</button>{' · '}
              <button className="link-btn" onClick={() => setReporting(!reporting)}>Report</button>
            </>
          )}
          {reporting && other && <ReportForm type="user" targetId={other.user_id} onDone={() => { setReporting(false); setMenu(false); }} />}
        </div>
      )}
      <div className="room-body">
        {more && <button className="link-btn" onClick={() => loadMsgs(msgs[0].created_at)}>Load earlier messages</button>}
        {msgs.length === 0 && <p className="muted small" style={{ textAlign: 'center' }}>No messages yet. Say hi 👋</p>}
        {msgs.map((m) => {
          const mine = m.sender_id === user.id;
          const who = members.find((x) => x.user_id === m.sender_id)?.profile;
          const quoted = m.reply_to && msgs.find((x) => x.id === m.reply_to);
          const counts = {};
          m.reactions.forEach((r) => { counts[r.emoji] = counts[r.emoji] || { n: 0, mine: false }; counts[r.emoji].n += 1; if (r.user_id === user.id) counts[r.emoji].mine = true; });
          const big = m.body && m.body.length <= 8 && /^\p{Extended_Pictographic}+$/u.test(m.body);
          return (
            <div key={m.id} className={'msg' + (mine ? ' mine' : '')}>
              {!mine && conv.is_group && <div className="small muted">{who?.display_name}</div>}
              <div className="bubble">
                {m.reply_to && <div className="quote">{quoted ? quoted.body || 'Photo' : 'Earlier message'}</div>}
                {m.image_path && urls[m.image_path] && <img src={urls[m.image_path]} alt="Shared" loading="lazy" />}
                {m.body && <span className={big ? 'sticker' : ''}>{m.body}</span>}
              </div>
              {Object.keys(counts).length > 0 && (
                <div className="reacts">{Object.entries(counts).map(([e, c]) => <button key={e} className={'chip' + (c.mine ? ' on' : '')} onClick={() => react(m, e)}>{e} {c.n}</button>)}</div>
              )}
              <div className="meta muted small">
                {clock(m.created_at)}
                <button className="link-btn" onClick={() => setPickFor(pickFor === m.id ? null : m.id)}>React</button>
                <button className="link-btn" onClick={() => setReply(m)}>Reply</button>
                {mine && <button className="link-btn" onClick={() => unsend(m)}>Unsend</button>}
              </div>
              {pickFor === m.id && <div className="reacts">{EMOJI.map((e) => <button key={e} className="chip" onClick={() => react(m, e)}>{e}</button>)}</div>}
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      {typers.length > 0 && <div className="muted small typing" role="status">{typers.join(', ')} {typers.length > 1 ? 'are' : 'is'} typing…</div>}
      {err && <p className="error small" role="alert">{err}</p>}
      {reply && <div className="replying small"><span className="clamp">Replying to: {reply.body || 'Photo'}</span><button className="link-btn" onClick={() => setReply(null)}>✕</button></div>}
      {showStk && stickers.length > 0 && <div className="reacts">{stickers.map((s) => <button key={s} className="chip big" onClick={() => { send(s); setShowStk(false); }}>{s}</button>)}</div>}
      <form className="composer-bar" onSubmit={submit}>
        <label className="btn ghost small-btn" aria-label="Send photo">📷<input type="file" accept={TYPES.join(',')} onChange={photo} hidden /></label>
        {stickers.length > 0 && <button type="button" className="btn ghost small-btn" onClick={() => setShowStk(!showStk)} aria-label="Stickers">✨</button>}
        <input value={text} onChange={onType} maxLength={2000} placeholder="Message" aria-label="Message" />
        <button className="btn small-btn" disabled={!text.trim()}>Send</button>
      </form>
    </div>
  );
}
