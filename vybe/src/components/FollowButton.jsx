import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { friendlyError } from '../lib/validate';

const LABEL = { none: 'Follow', pending: 'Requested', accepted: 'Following' };

export default function FollowButton({ targetId, status, onChange }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!user || user.id === targetId) return null;

  async function toggle() {
    setBusy(true); setErr('');
    if (status === 'none') {
      // The database decides 'accepted' or 'pending' based on whether the account is private.
      const { data, error } = await supabase.from('follows')
        .insert({ follower_id: user.id, following_id: targetId }).select('status').single();
      if (error) setErr(friendlyError(error)); else onChange(data.status);
    } else {
      const { error } = await supabase.from('follows').delete().match({ follower_id: user.id, following_id: targetId });
      if (error) setErr(friendlyError(error)); else onChange('none');
    }
    setBusy(false);
  }

  return (
    <>
      <button className={'btn' + (status === 'none' ? '' : ' ghost')} onClick={toggle} disabled={busy}>{LABEL[status]}</button>
      {err && <p className="error" role="alert">{err}</p>}
    </>
  );
}
