import { usePosts } from '../hooks/usePosts';
import PostCard from './PostCard';

export default function PostList({ mode, author, post, empty }) {
  const { posts, setPosts, state, more, busy, reload, next } = usePosts({ mode, author, post });
  if (state === 'loading') return <><div className="skeleton" aria-busy="true" /><div className="skeleton" /></>;
  if (state === 'error') return <div className="empty"><p className="error">Could not load posts.</p><button className="btn ghost" onClick={reload}>Try again</button></div>;
  if (!posts.length) return empty;
  return (
    <>
      {posts.map((p) => (
        <PostCard key={p.id} post={p}
          onChange={(np) => setPosts((o) => o.map((x) => (x.id === np.id ? np : x)))}
          onDelete={(id) => setPosts((o) => o.filter((x) => x.id !== id))} />
      ))}
      {more && <button className="btn ghost" disabled={busy} onClick={next}>{busy ? 'Loading…' : 'Load more'}</button>}
    </>
  );
}
