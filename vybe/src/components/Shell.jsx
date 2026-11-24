import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUnread } from '../hooks/useUnread';
import { APP_NAME } from '../config';

const ICONS = {
  home: 'M3 11l9-8 9 8v10H3z',
  explore: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5',
  reels: 'M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zM10 8l6 4-6 4z',
  chats: 'M21 12a8 8 0 01-11.5 7.2L3 21l1.8-6.5A8 8 0 1121 12z',
  profile: 'M12 4a4 4 0 100 8 4 4 0 000-8zM4 21c1-4 4-6 8-6s7 2 8 6',
};
const TABS = [['/', 'Home', 'home'], ['/explore', 'Explore', 'explore'], ['/reels', 'Reels', 'reels'], ['/chats', 'Chats', 'chats'], ['/profile', 'Profile', 'profile']];

export default function Shell() {
  const { user } = useAuth();
  const unread = useUnread(user?.id);
  const loc = useLocation();
  const room = /^\/chats\/[0-9a-f-]{36}$/.test(loc.pathname);
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="wordmark">{APP_NAME}</Link>
        {user && (
          <span className="topbar-links">
            <Link to="/notifications" className="topbar-link" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>Alerts{unread > 0 && <span className="badge">{unread > 99 ? '99+' : unread}</span>}</Link>
            <details className="menu" key={loc.pathname}>
              <summary>Menu</summary>
              <div className="menu-panel">
                <Link to="/requests">Follow requests</Link><Link to="/saved">Saved</Link><Link to="/studio">Theme Studio</Link>
                <Link to="/store">Store</Link><Link to="/settings">Settings</Link>
              </div>
            </details>
          </span>
        )}
      </header>
      <main className={'content' + (room ? ' room-content' : '')}><Outlet /></main>
      {user && !room && (
        <nav className="tabs" aria-label="Main">
          {TABS.map(([to, label, ic]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => 'tab' + (isActive ? ' on' : '')}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[ic]} /></svg>{label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
