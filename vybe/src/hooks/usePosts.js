import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const PAGE = 10;

// Loads posts 10 at a time (newest first) through the get_posts database function.
export function usePosts({ mode, author = null, post = null }) {
  const [posts, setPosts] = useState([]);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (before) => {
    setBusy(true);
    const { data, error } = await supabase.rpc('get_posts', {
      p_mode: mode, p_author: author, p_post: post, p_before: before ?? null, p_limit: PAGE,
    });
    if (error) { setBusy(false); setState('error'); return; }
    const paths = data.map((p) => p.image_path).filter(Boolean);
    const urls = {};
    if (paths.length) {
      const { data: signed } = await supabase.storage.from('post-images').createSignedUrls(paths, 3600);
      (signed || []).forEach((x) => { if (x.signedUrl) urls[x.path] = x.signedUrl; });
    }
    const rows = data.map((p) => ({ ...p, image_url: urls[p.image_path] || null }));
    setPosts((old) => (before ? [...old, ...rows] : rows));
    setMore(data.length === PAGE);
    setState('ready');
    setBusy(false);
  }, [mode, author, post]);

  useEffect(() => { setState('loading'); setPosts([]); load(null); }, [load]);

  return {
    posts, setPosts, state, more, busy,
    reload: () => { setState('loading'); load(null); },
    next: () => load(posts[posts.length - 1]?.created_at),
  };
}
