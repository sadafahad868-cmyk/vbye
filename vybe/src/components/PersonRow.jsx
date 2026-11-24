import { useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from './Avatar';
import FollowButton from './FollowButton';

export default function PersonRow({ p }) {
  const [status, setStatus] = useState(p.follow_status || 'none');
  return (
    <div className="person">
      <Link to={`/u/${p.username}`}><Avatar profile={p} size={46} /></Link>
      <div className="grow">
        <Link className="nm" to={`/u/${p.username}`}>{p.display_name}</Link>
        <div className="muted small">@{p.username} · {Number(p.followers ?? 0).toLocaleString()} followers</div>
        {p.bio && <div className="small clamp">{p.bio}</div>}
      </div>
      <FollowButton targetId={p.id} status={status} onChange={setStatus} />
    </div>
  );
}
