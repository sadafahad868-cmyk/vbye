export default function Avatar({ profile, size = 44 }) {
  const style = { width: size, height: size, fontSize: size * 0.4 };
  if (profile?.avatar_url) {
    return <img className="avatar" style={style} src={profile.avatar_url} alt="" loading="lazy" />;
  }
  return <div className="avatar" style={style}>{(profile?.display_name || '?')[0].toUpperCase()}</div>;
}
