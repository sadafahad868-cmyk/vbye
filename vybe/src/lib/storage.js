import { supabase } from './supabase';

export async function signMany(bucket, paths, seconds = 3600) {
  const list = paths.filter(Boolean);
  const urls = {};
  if (!list.length) return urls;
  const { data } = await supabase.storage.from(bucket).createSignedUrls(list, seconds);
  (data || []).forEach((x) => { if (x.signedUrl) urls[x.path] = x.signedUrl; });
  return urls;
}
// Deletes every file the person uploaded (used before account deletion).
export async function removeMyFiles(uid) {
  for (const bucket of ['avatars', 'post-images', 'reels']) {
    const { data } = await supabase.storage.from(bucket).list(uid, { limit: 1000 });
    if (data?.length) await supabase.storage.from(bucket).remove(data.map((f) => `${uid}/${f.name}`));
  }
}
