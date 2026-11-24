export default function Pending({ title, phase, note }) {
  return (
    <div className="empty">
      <div className="empty-mark" aria-hidden="true">◌</div>
      <h2>{title}</h2>
      <p className="muted">{note}</p>
      {phase > 0 && <span className="pill">Pending · Phase {phase}</span>}
    </div>
  );
}
