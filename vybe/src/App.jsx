import { Route, Routes } from 'react-router-dom';
import { supabaseReady } from './lib/supabase';
import { Protected, PublicOnly } from './components/Guards';
import Shell from './components/Shell';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Home from './pages/Home';
import Profile, { MyProfileRedirect } from './pages/Profile';
import EditProfile from './pages/EditProfile';
import Settings from './pages/Settings';
import Pending from './pages/Pending';
import FollowList from './pages/FollowList';
import Requests from './pages/Requests';
import BlockedAccounts from './pages/BlockedAccounts';
import Saved from './pages/Saved';
import PostPage from './pages/PostPage';
import ChatList from './pages/ChatList';
import NewChat from './pages/NewChat';
import ChatRoom from './pages/ChatRoom';
import ReelsFeed, { SingleReel, TagReels } from './pages/ReelsFeed';
import ReelUpload from './pages/ReelUpload';
import Explore from './pages/Explore';
import Notifications from './pages/Notifications';
import ThemeStudio from './pages/ThemeStudio';
import Store from './pages/Store';
import Admin from './pages/Admin';

function Setup() {
  return (
    <div className="empty">
      <h2>Setup needed</h2>
      <p className="muted">Create a <code>.env</code> file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart <code>npm run dev</code>.</p>
    </div>
  );
}
const P = (el) => <Protected>{el}</Protected>;

export default function App() {
  if (!supabaseReady) return <Setup />;
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
      <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<Shell />}>
        {/* Public links. Private content stays hidden by database rules. */}
        <Route path="/u/:username" element={<Profile />} />
        <Route path="/u/:username/followers" element={<FollowList kind="followers" />} />
        <Route path="/u/:username/following" element={<FollowList kind="following" />} />
        <Route path="/post/:id" element={<PostPage />} />
        <Route path="/reel/:id" element={P(<SingleReel />)} />
        <Route path="/tag/:tag" element={P(<TagReels />)} />
        <Route path="/" element={P(<Home />)} />
        <Route path="/explore" element={P(<Explore />)} />
        <Route path="/reels" element={P(<ReelsFeed />)} />
        <Route path="/reels/new" element={P(<ReelUpload />)} />
        <Route path="/chats" element={P(<ChatList />)} />
        <Route path="/chats/new" element={P(<NewChat />)} />
        <Route path="/chats/:id" element={P(<ChatRoom />)} />
        <Route path="/notifications" element={P(<Notifications />)} />
        <Route path="/profile" element={P(<MyProfileRedirect />)} />
        <Route path="/profile/edit" element={P(<EditProfile />)} />
        <Route path="/studio" element={P(<ThemeStudio />)} />
        <Route path="/store" element={P(<Store />)} />
        <Route path="/settings" element={P(<Settings />)} />
        <Route path="/settings/blocked" element={P(<BlockedAccounts />)} />
        <Route path="/requests" element={P(<Requests />)} />
        <Route path="/saved" element={P(<Saved />)} />
        <Route path="/admin" element={P(<Admin />)} />
        <Route path="*" element={<Pending title="Page not found" phase={0} note="This page does not exist." />} />
      </Route>
    </Routes>
  );
}
