import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Unread notification count with live updates.
export function useUnread(uid) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!uid) return;
    const load = async () => {
      const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
      setN(count || 0);
    };
    load();
    const ch = supabase.channel('notif:' + uid)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, load)
      .subscribe();
    window.addEventListener('notif-read', load);
    return () => { supabase.removeChannel(ch); window.removeEventListener('notif-read', load); };
  }, [uid]);
  return n;
}
