import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Composer from '../components/Composer';
import PostList from '../components/PostList';

function FeedEmpty() {
  const [name, setName] = useState('');
  const nav = useNavigate();
  function go(e) { e.preventDefault(); const u = name.trim().toLowerCase().replace(/^@/, ''); if (u) nav(`/u/${u}`); }
  return (
    <div className="empty">
      <div className="empty-mark" aria-hidden="true">◌</div>
      <h2>Your feed is quiet</h2>
      <p className="muted">Follow people to see their posts here. Know someone already? Open their profile by username.</p>
      <form className="comment-form" onSubmit={go}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="username" aria-label="Username" autoCapitalize="none" />
        <button className="btn small-btn">Open</button>
      </form>
      <p className="muted small">Full search and suggested creators arrive with Explore in Phase 6.</p>
    </div>
  );
}

export default function Home() {
  const [v, setV] = useState(0);
  return (
    <>
      <Composer onPosted={() => setV(v + 1)} />
      <PostList key={v} mode="feed" empty={<FeedEmpty />} />
    </>
  );
}
