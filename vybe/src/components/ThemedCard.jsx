import Avatar from './Avatar';
import { heroStyle } from '../lib/theme';

// The themed top part of a profile. Used on profiles and in the Theme Studio preview.
export default function ThemedCard({ resolved, profile, children }) {
  return (
    <div className={'hero card-' + resolved.card} style={heroStyle(resolved)}>
      <Avatar profile={profile} size={92} />
      <h1>{profile.display_name}</h1>
      <p className="muted">@{profile.username}</p>
      {profile.mood && <p className="mood">{profile.mood}</p>}
      {profile.bio && <p className="bio">{profile.bio}</p>}
      {children}
    </div>
  );
}
