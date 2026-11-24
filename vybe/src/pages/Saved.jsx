import PostList from '../components/PostList';

export default function Saved() {
  return (
    <div className="page">
      <h1>Saved posts</h1>
      <PostList mode="saved" empty={<div className="empty"><h2>Nothing saved yet</h2><p className="muted">Tap Save on a post to keep it here.</p></div>} />
    </div>
  );
}
