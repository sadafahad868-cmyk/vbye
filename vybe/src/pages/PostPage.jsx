import { useParams } from 'react-router-dom';
import PostList from '../components/PostList';

export default function PostPage() {
  const { id } = useParams();
  return <PostList mode="single" post={id} empty={<div className="empty"><h2>Post unavailable</h2><p className="muted">It may have been deleted or the account is private.</p></div>} />;
}
