import { APP_NAME, TAGLINE } from '../config';

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth">
      <div className="auth-top">
        <div className="wordmark big">{APP_NAME}</div>
        <p>{TAGLINE}</p>
      </div>
      <div className="auth-sheet">
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
