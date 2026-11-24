import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import PersonRow from '../components/PersonRow';

const INTERESTS = ['music', 'design', 'gaming', 'travel', 'fitness', 'coding', 'art', 'food', 'fashion', 'photography', 'dance', 'movies'];
const PAGE = 15;

export default function Explore() {
  const [q, setQ] = useState('');
  const [interest, setInterest] = useState(null);
  const [rows, setRows] = useState([]);
  const [sugg, setSugg] = useState([]);
  const [more, setMore] = useState(false);
  const [state, setState] = useState('loading');
  const [busy, setBusy] = useState(false);
  const term = q.trim().replace(/^@/, '');
  const searching = Boolean(term) && !term.startsWith('#');

  const fetchRows = useCallback(async (offset) => {
    let res;
    if (searching) res = await supabase.rpc('search_profiles', { p_q: term, p_limit: PAGE, p_offset: offset });
    else if (interest) res = await supabase.rpc('profiles_by_interest', { p_interest: interest, p_limit: PAGE, p_offset: offset });
    else res = await supabase.rpc('trending_profiles', { p_limit: PAGE, p_offset: offset });
    if (res.error) { setState('error'); return; }
    setRows((o) => (offset ? [...o, ...res.data] : res.data));
    setMore(res.data.length === PAGE); setState('ready'); setBusy(false);
  }, [searching, term, interest]);

  useEffect(() => {
    setState('loading');
    const t = setTimeout(() => fetchRows(0), searching ? 350 : 0);
    return () => clearTimeout(t);
  }, [fetchRows, searching]);
  useEffect(() => { supabase.rpc('suggested_profiles', { p_limit: 8 }).then(({ data }) => setSugg(data || [])); }, []);

  const heading = searching ? 'Results' : interest ? `#${interest} creators` : 'Trending creators';
  return (
    <div className="page">
      <h1>Explore</h1>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by username" aria-label="Search" autoCapitalize="none" />
      {term.startsWith('#') && term.length > 1 && <Link className="btn ghost" to={`/tag/${term.slice(1).toLowerCase()}`}>Open reels tagged {term.toLowerCase()}</Link>}
      <div className="chips left">
        {INTERESTS.map((i) => <button key={i} className={'chip' + (interest === i ? ' on' : '')} onClick={() => setInterest(interest === i ? null : i)}>{i}</button>)}
      </div>
      {!searching && !interest && sugg.length > 0 && (
        <><h2>Suggested for you</h2>{sugg.map((p) => <PersonRow key={p.id} p={p} />)}</>
      )}
      <h2>{heading}</h2>
      {state === 'loading' && <div className="skeleton short" aria-busy="true" />}
      {state === 'error' && <p className="error">Could not load. <button className="link-btn" onClick={() => fetchRows(0)}>Retry</button></p>}
      {state === 'ready' && rows.length === 0 && <div className="empty"><h2>No one found</h2><p className="muted">Try another name or interest.</p></div>}
      {state === 'ready' && rows.map((p) => <PersonRow key={p.id} p={p} />)}
      {more && <button className="btn ghost" disabled={busy} onClick={() => { setBusy(true); fetchRows(rows.length); }}>{busy ? 'Loading…' : 'Load more'}</button>}
      <p className="muted small">Private accounts appear only when you search their username. They never show in trending or suggestions.</p>
    </div>
  );
}
