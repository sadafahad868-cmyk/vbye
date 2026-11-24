-- VYBE Phases 4-8: chat, reels, explore, notifications, theme studio, store, moderation.
-- Run this whole file once in Supabase > SQL Editor (after phase2.sql and phase3.sql).
-- It is safe to run again.

------------------------------------------------------------ PROFILE SETTINGS
alter table public.profiles
  add column if not exists message_policy text not null default 'everyone',
  add column if not exists show_online    boolean not null default true,
  add column if not exists notif_prefs    jsonb   not null default '{}'::jsonb;
alter table public.profiles drop constraint if exists message_policy_check;
alter table public.profiles add constraint message_policy_check
  check (message_policy in ('everyone','following','nobody'));
create index if not exists profiles_username_prefix_idx on public.profiles (lower(username) text_pattern_ops);

revoke update on public.profiles from authenticated, anon;
grant update (display_name, bio, interests, mood, avatar_url, is_private, theme,
              message_policy, show_online, notif_prefs) on public.profiles to authenticated;

------------------------------------------------------------ THEMES + STORE
create table if not exists public.themes (
  id         text primary key,
  name       text not null,
  kind       text not null check (kind in ('theme','design','stickers')),
  is_premium boolean not null default false,
  price_inr  int not null default 0 check (price_inr >= 0),
  config     jsonb not null default '{}'::jsonb,
  active     boolean not null default true
);
insert into public.themes (id, name, kind, is_premium, price_inr, config) values
 ('wine-classic','Wine Classic','theme',false,0,'{"bg":"linear-gradient(160deg,#722F37,#C98289)","ink":"#FFF1DC"}'),
 ('cream-soft','Cream Soft','theme',false,0,'{"bg":"linear-gradient(160deg,#FFF1DC,#C98289)","ink":"#302426"}'),
 ('night-ink','Night Ink','theme',false,0,'{"bg":"linear-gradient(160deg,#211719,#3a2227)","ink":"#FFF1DC"}'),
 ('velvet-night','Velvet Night','theme',true,49,'{"bg":"radial-gradient(circle at 30% 20%,#9b3a47,#211719 70%)","ink":"#FFF1DC"}'),
 ('golden-hour','Golden Hour','theme',true,49,'{"bg":"linear-gradient(160deg,#C98289,#f5c27a)","ink":"#302426"}'),
 ('aurora-rose','Aurora Rose (special design)','design',true,99,'{"bg":"linear-gradient(135deg,#722F37,#C98289 45%,#f7d6c4)","ink":"#FFF1DC"}'),
 ('vybe-stickers-1','Wine Night Stickers','stickers',true,49,'{"stickers":["🍷","🌹","✨","🔥","💋","🎧","🌙","🫶"]}')
on conflict (id) do nothing;

create table if not exists public.purchases (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  theme_id            text not null references public.themes(id),
  amount_inr          int not null,
  provider            text not null default 'razorpay',
  provider_order_id   text unique,
  provider_payment_id text unique,
  status              text not null default 'created' check (status in ('created','paid','failed','refunded')),
  created_at          timestamptz not null default now(),
  paid_at             timestamptz
);
create index if not exists purchases_user_idx on public.purchases (user_id, created_at desc);

alter table public.themes    enable row level security;
alter table public.purchases enable row level security;
drop policy if exists themes_select on public.themes;
create policy themes_select on public.themes for select using (active);
-- Purchases can only be written by the payment Edge Functions (service role). Users can read their own.
drop policy if exists purchases_select on public.purchases;
create policy purchases_select on public.purchases for select to authenticated using (user_id = auth.uid());

-- Profile theme is validated on the server: safe values only, and premium themes must be paid for.
create or replace function public.check_theme()
returns trigger language plpgsql security definer set search_path = public as $$
declare t jsonb := new.theme; tid text := new.theme->>'theme_id'; prem boolean;
begin
  if t is not distinct from old.theme then return new; end if;
  if t is null or jsonb_typeof(t) <> 'object' then raise exception 'bad_theme'; end if;
  if octet_length(t::text) > 400 then raise exception 'bad_theme'; end if;
  if (t->>'bg') is not null   and (t->>'bg')  !~ '^#[0-9a-fA-F]{6}$' then raise exception 'bad_theme'; end if;
  if (t->>'ink') is not null  and (t->>'ink') !~ '^#[0-9a-fA-F]{6}$' then raise exception 'bad_theme'; end if;
  if (t->>'font') is not null and (t->>'font') not in ('serif','sans','mono','rounded') then raise exception 'bad_theme'; end if;
  if (t->>'card') is not null and (t->>'card') not in ('flat','glass','outline') then raise exception 'bad_theme'; end if;
  if tid is not null then
    select is_premium into prem from public.themes where id = tid and active and kind <> 'stickers';
    if prem is null then raise exception 'bad_theme'; end if;
    if prem and not exists (select 1 from public.purchases
                            where user_id = new.id and theme_id = tid and status = 'paid') then
      raise exception 'not_owned';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_check_theme on public.profiles;
create trigger profiles_check_theme before update on public.profiles
  for each row execute function public.check_theme();

------------------------------------------------------------ CHAT
create table if not exists public.conversations (
  id                   uuid primary key default gen_random_uuid(),
  is_group             boolean not null default false,
  title                text check (title is null or char_length(title) between 1 and 40),
  created_by           uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  last_message_at      timestamptz not null default now(),
  last_message_preview text
);
create index if not exists conversations_last_idx on public.conversations (last_message_at desc);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  role            text not null default 'member' check (role in ('owner','member')),
  status          text not null default 'active' check (status in ('active','request','invited')),
  last_read_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists conv_members_user_idx on public.conversation_members (user_id, status);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text check (body is null or char_length(body) between 1 and 2000),
  image_path      text,
  reply_to        uuid references public.messages(id) on delete set null,
  created_at      timestamptz not null default now(),
  check (body is not null or image_path is not null)
);
create index if not exists messages_conv_idx on public.messages (conversation_id, created_at desc);

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create or replace function public.is_active_member(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.conversation_members
    where conversation_id = cid and user_id = auth.uid() and status = 'active');
$$;

create or replace function public.can_send(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_active_member(cid) and coalesce((
    select c.is_group or (
      exists (select 1 from public.conversation_members m where m.conversation_id = cid and m.user_id <> auth.uid())
      and not exists (select 1 from public.conversation_members m
                      where m.conversation_id = cid and m.user_id <> auth.uid() and public.is_blocked_pair(m.user_id)))
    from public.conversations c where c.id = cid), false);
$$;

alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages             enable row level security;
alter table public.message_reactions    enable row level security;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public'
           and tablename in ('conversations','conversation_members','messages','message_reactions')
  loop execute format('drop policy %I on public.%I', r.policyname, r.tablename); end loop;
end $$;

create policy conv_select on public.conversations for select to authenticated
  using (exists (select 1 from public.conversation_members m where m.conversation_id = conversations.id and m.user_id = auth.uid()));
create policy members_select on public.conversation_members for select to authenticated
  using (user_id = auth.uid() or public.is_active_member(conversation_id));
create policy members_leave on public.conversation_members for delete to authenticated
  using (user_id = auth.uid());                                  -- leave group, decline invite
create policy messages_select on public.messages for select to authenticated
  using (public.is_active_member(conversation_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.can_send(conversation_id));
create policy messages_delete on public.messages for delete to authenticated
  using (sender_id = auth.uid());
create policy reactions_select on public.message_reactions for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id));
create policy reactions_insert on public.message_reactions for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.messages m where m.id = message_id));
create policy reactions_delete on public.message_reactions for delete to authenticated
  using (user_id = auth.uid());

-- Anti-spam: 3 messages max while the other person has not accepted the request.
create or replace function public.messages_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.conversation_members m
             where m.conversation_id = new.conversation_id and m.user_id <> new.sender_id and m.status = 'request')
     and (select count(*) from public.messages x
          where x.conversation_id = new.conversation_id and x.sender_id = new.sender_id) >= 3 then
    raise exception 'request_limit';
  end if;
  return new;
end $$;
drop trigger if exists messages_guard_trg on public.messages;
create trigger messages_guard_trg before insert on public.messages
  for each row execute function public.messages_guard();

create or replace function public.messages_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare m record;
begin
  update public.conversations
     set last_message_at = new.created_at, last_message_preview = left(coalesce(new.body, 'Photo'), 80)
   where id = new.conversation_id;
  for m in select user_id, status from public.conversation_members
           where conversation_id = new.conversation_id and user_id <> new.sender_id and status in ('active','request')
  loop
    perform public.notify(m.user_id, new.sender_id,
                          case when m.status = 'request' then 'message_request' else 'message' end,
                          new.conversation_id);
  end loop;
  return new;
end $$;
drop trigger if exists messages_after_insert_trg on public.messages;
create trigger messages_after_insert_trg after insert on public.messages
  for each row execute function public.messages_after_insert();

drop trigger if exists messages_rate on public.messages;
create trigger messages_rate before insert on public.messages
  for each row execute function public.limit_rate(300, '1 hour', 'sender_id');
drop trigger if exists conversations_rate on public.conversations;
create trigger conversations_rate before insert on public.conversations
  for each row execute function public.limit_rate(20, '1 hour', 'created_by');

create or replace function public.start_dm(p_user uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cid uuid; pol text; rf boolean;
begin
  if me is null or p_user = me then raise exception 'invalid'; end if;
  if public.is_blocked_pair(p_user) then raise exception 'not_allowed'; end if;
  select c.id into cid from public.conversations c
   where not c.is_group
     and exists (select 1 from public.conversation_members where conversation_id = c.id and user_id = me)
     and exists (select 1 from public.conversation_members where conversation_id = c.id and user_id = p_user)
   limit 1;
  if cid is not null then return cid; end if;
  select message_policy into pol from public.profiles where id = p_user;
  if pol is null then raise exception 'not_allowed'; end if;
  rf := exists (select 1 from public.follows where follower_id = p_user and following_id = me and status = 'accepted');
  if pol = 'nobody' or (pol = 'following' and not rf) then raise exception 'not_allowed'; end if;
  insert into public.conversations (is_group, created_by) values (false, me) returning id into cid;
  insert into public.conversation_members (conversation_id, user_id, role, status)
    values (cid, me, 'member', 'active'), (cid, p_user, 'member', case when rf then 'active' else 'request' end);
  return cid;
end $$;

create or replace function public.create_group(p_title text, p_members uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cid uuid; m uuid;
begin
  if me is null then raise exception 'invalid'; end if;
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 40 then raise exception 'invalid'; end if;
  if cardinality(p_members) > 19 then raise exception 'too_many'; end if;
  insert into public.conversations (is_group, title, created_by) values (true, trim(p_title), me) returning id into cid;
  insert into public.conversation_members (conversation_id, user_id, role, status) values (cid, me, 'owner', 'active');
  foreach m in array p_members loop
    if m <> me and not public.is_blocked_pair(m) and exists (select 1 from public.profiles where id = m) then
      insert into public.conversation_members (conversation_id, user_id, status) values (cid, m, 'invited')
        on conflict do nothing;
    end if;
  end loop;
  return cid;
end $$;

create or replace function public.respond_conversation(p_cid uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_accept then
    update public.conversation_members set status = 'active', last_read_at = now()
     where conversation_id = p_cid and user_id = auth.uid() and status in ('request','invited');
  else
    delete from public.conversation_members
     where conversation_id = p_cid and user_id = auth.uid() and status in ('request','invited');
  end if;
end $$;

create or replace function public.mark_read(p_cid uuid)
returns void language sql security definer set search_path = public as $$
  update public.conversation_members set last_read_at = now()
   where conversation_id = p_cid and user_id = auth.uid() and status = 'active';
$$;

create or replace function public.chat_list()
returns table (id uuid, is_group boolean, title text, last_message_at timestamptz, last_message_preview text,
               status text, unread bigint, other_id uuid, username text, display_name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select c.id, c.is_group, c.title, c.last_message_at, c.last_message_preview, me.status,
         (select count(*) from public.messages m
           where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.created_at > me.last_read_at),
         o.user_id, op.username, op.display_name, op.avatar_url
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  left join lateral (select x.user_id from public.conversation_members x
                      where x.conversation_id = c.id and x.user_id <> auth.uid() and not c.is_group limit 1) o on true
  left join public.profiles op on op.id = o.user_id
  where me.user_id = auth.uid()
    and not (not c.is_group and o.user_id is not null and public.is_blocked_pair(o.user_id))
  order by c.last_message_at desc
  limit 60;
$$;

grant execute on function public.start_dm(uuid), public.create_group(text, uuid[]),
  public.respond_conversation(uuid, boolean), public.mark_read(uuid), public.chat_list() to authenticated;
revoke execute on function public.start_dm(uuid), public.create_group(text, uuid[]),
  public.respond_conversation(uuid, boolean), public.mark_read(uuid), public.chat_list() from public, anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', false, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, public = false;

drop policy if exists chat_images_select on storage.objects;
create policy chat_images_select on storage.objects for select to authenticated using (
  bucket_id = 'chat-images' and case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    then public.is_active_member(((storage.foldername(name))[1])::uuid) else false end);
drop policy if exists chat_images_insert on storage.objects;
create policy chat_images_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'chat-images' and case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    then public.can_send(((storage.foldername(name))[1])::uuid) else false end);

------------------------------------------------------------ REELS
create table if not exists public.reels (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles(id) on delete cascade,
  video_path text not null,
  thumb_path text,
  caption    text check (caption is null or char_length(caption) <= 150),
  hashtags   text[] not null default '{}' check (cardinality(hashtags) <= 5),
  created_at timestamptz not null default now(),
  check ((storage.foldername(video_path))[1] = author_id::text)
);
create index if not exists reels_created_idx on public.reels (created_at desc);
create index if not exists reels_author_idx  on public.reels (author_id, created_at desc);
create index if not exists reels_tags_idx    on public.reels using gin (hashtags);

create table if not exists public.reel_likes (
  reel_id uuid not null references public.reels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reel_id, user_id)
);
create table if not exists public.reel_saves (
  reel_id uuid not null references public.reels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reel_id, user_id)
);
create table if not exists public.reel_comments (
  id         uuid primary key default gen_random_uuid(),
  reel_id    uuid not null references public.reels(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists reel_comments_idx on public.reel_comments (reel_id, created_at desc);

alter table public.reels         enable row level security;
alter table public.reel_likes    enable row level security;
alter table public.reel_saves    enable row level security;
alter table public.reel_comments enable row level security;
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public'
           and tablename in ('reels','reel_likes','reel_saves','reel_comments')
  loop execute format('drop policy %I on public.%I', r.policyname, r.tablename); end loop;
end $$;

create policy reels_select on public.reels for select using (public.can_view_content(author_id));
create policy reels_insert on public.reels for insert to authenticated with check (author_id = auth.uid());
create policy reels_delete on public.reels for delete to authenticated using (author_id = auth.uid());
create policy rlikes_select on public.reel_likes for select using (exists (select 1 from public.reels r where r.id = reel_id));
create policy rlikes_insert on public.reel_likes for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.reels r where r.id = reel_id));
create policy rlikes_delete on public.reel_likes for delete to authenticated using (user_id = auth.uid());
create policy rsaves_select on public.reel_saves for select to authenticated using (user_id = auth.uid());
create policy rsaves_insert on public.reel_saves for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.reels r where r.id = reel_id));
create policy rsaves_delete on public.reel_saves for delete to authenticated using (user_id = auth.uid());
create policy rcomments_select on public.reel_comments for select using (exists (select 1 from public.reels r where r.id = reel_id));
create policy rcomments_insert on public.reel_comments for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.reels r where r.id = reel_id));
create policy rcomments_delete on public.reel_comments for delete to authenticated
  using (author_id = auth.uid() or exists (select 1 from public.reels r where r.id = reel_id and r.author_id = auth.uid()));

drop trigger if exists reels_rate on public.reels;
create trigger reels_rate before insert on public.reels
  for each row execute function public.limit_rate(10, '1 day', 'author_id');
drop trigger if exists reel_comments_rate on public.reel_comments;
create trigger reel_comments_rate before insert on public.reel_comments
  for each row execute function public.limit_rate(60, '1 hour', 'author_id');

create or replace function public.get_reels(
  p_mode text, p_author uuid default null, p_tag text default null, p_reel uuid default null,
  p_before timestamptz default null, p_limit int default 6)
returns table (id uuid, author_id uuid, video_path text, thumb_path text, caption text, hashtags text[],
               created_at timestamptz, username text, display_name text, avatar_url text,
               like_count bigint, comment_count bigint, liked boolean, saved boolean, follow_status text)
language sql stable security invoker set search_path = public as $$
  select r.id, r.author_id, r.video_path, r.thumb_path, r.caption, r.hashtags, r.created_at,
         pr.username, pr.display_name, pr.avatar_url,
         (select count(*) from public.reel_likes l where l.reel_id = r.id),
         (select count(*) from public.reel_comments c where c.reel_id = r.id),
         exists (select 1 from public.reel_likes l where l.reel_id = r.id and l.user_id = auth.uid()),
         exists (select 1 from public.reel_saves s where s.reel_id = r.id and s.user_id = auth.uid()),
         coalesce((select f.status from public.follows f where f.follower_id = auth.uid() and f.following_id = r.author_id), 'none')
  from public.reels r
  join public.profiles pr on pr.id = r.author_id
  where (p_before is null or r.created_at < p_before)
    and case p_mode
          when 'feed'   then true
          when 'user'   then r.author_id = p_author
          when 'tag'    then lower(p_tag) = any (r.hashtags)
          when 'single' then r.id = p_reel
          when 'saved'  then exists (select 1 from public.reel_saves s where s.reel_id = r.id and s.user_id = auth.uid())
          else false end
  order by r.created_at desc
  limit least(greatest(p_limit, 1), 20);
$$;
grant execute on function public.get_reels(text, uuid, text, uuid, timestamptz, int) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reels', 'reels', false, 52428800, array['video/mp4','video/webm','video/quicktime','image/jpeg'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, public = false,
  allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists reels_obj_select on storage.objects;
create policy reels_obj_select on storage.objects for select using (
  bucket_id = 'reels' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.reels r where (r.video_path = name or r.thumb_path = name)
                                                   and public.can_view_content(r.author_id))));
drop policy if exists reels_obj_insert on storage.objects;
create policy reels_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'reels' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists reels_obj_delete on storage.objects;
create policy reels_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'reels' and (storage.foldername(name))[1] = auth.uid()::text);

------------------------------------------------------------ EXPLORE
create or replace function public.search_profiles(p_q text, p_limit int default 20, p_offset int default 0)
returns table (id uuid, username text, display_name text, avatar_url text, bio text, followers bigint, follow_status text)
language sql stable security definer set search_path = public as $$
  with q as (select lower(regexp_replace(trim(p_q), '[%_\\]', '', 'g')) as s)
  select pr.id, pr.username, pr.display_name, pr.avatar_url, pr.bio,
         (select count(*) from public.follows f where f.following_id = pr.id and f.status = 'accepted'),
         coalesce((select f.status from public.follows f where f.follower_id = auth.uid() and f.following_id = pr.id), 'none')
  from public.profiles pr, q
  where auth.uid() is not null and char_length(q.s) >= 1
    and pr.id <> auth.uid() and not public.is_blocked_pair(pr.id)
    and (lower(pr.username) like q.s || '%'                                   -- private accounts: username prefix only
         or (not pr.is_private and lower(pr.display_name) like '%' || q.s || '%'))
  order by (lower(pr.username) = q.s) desc, pr.username
  limit least(p_limit, 30) offset p_offset;
$$;

create or replace function public.trending_profiles(p_limit int default 20, p_offset int default 0)
returns table (id uuid, username text, display_name text, avatar_url text, bio text, followers bigint, follow_status text)
language sql stable security definer set search_path = public as $$
  select pr.id, pr.username, pr.display_name, pr.avatar_url, pr.bio,
         (select count(*) from public.follows f where f.following_id = pr.id and f.status = 'accepted'),
         coalesce((select f.status from public.follows f where f.follower_id = auth.uid() and f.following_id = pr.id), 'none')
  from public.profiles pr
  where auth.uid() is not null and not pr.is_private and pr.id <> auth.uid() and not public.is_blocked_pair(pr.id)
  order by ((select count(*) from public.follows f where f.following_id = pr.id and f.status = 'accepted'
                and f.created_at > now() - interval '30 days') * 3
          + (select count(*) from public.post_likes l join public.posts p on p.id = l.post_id
              where p.author_id = pr.id and l.created_at > now() - interval '14 days')) desc,
           pr.created_at desc
  limit least(p_limit, 30) offset p_offset;
$$;

create or replace function public.suggested_profiles(p_limit int default 10)
returns table (id uuid, username text, display_name text, avatar_url text, bio text, followers bigint, follow_status text)
language sql stable security definer set search_path = public as $$
  select pr.id, pr.username, pr.display_name, pr.avatar_url, pr.bio,
         (select count(*) from public.follows f where f.following_id = pr.id and f.status = 'accepted'),
         'none'::text
  from public.profiles pr
  where auth.uid() is not null and not pr.is_private and pr.id <> auth.uid() and not public.is_blocked_pair(pr.id)
    and not exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = pr.id)
  order by coalesce((select cardinality(array(select unnest(pr.interests) intersect
                                              select unnest(m.interests))) from public.profiles m where m.id = auth.uid()), 0) desc,
           pr.created_at desc
  limit least(p_limit, 20);
$$;

create or replace function public.profiles_by_interest(p_interest text, p_limit int default 20, p_offset int default 0)
returns table (id uuid, username text, display_name text, avatar_url text, bio text, followers bigint, follow_status text)
language sql stable security definer set search_path = public as $$
  select pr.id, pr.username, pr.display_name, pr.avatar_url, pr.bio,
         (select count(*) from public.follows f where f.following_id = pr.id and f.status = 'accepted'),
         coalesce((select f.status from public.follows f where f.follower_id = auth.uid() and f.following_id = pr.id), 'none')
  from public.profiles pr
  where auth.uid() is not null and not pr.is_private and pr.id <> auth.uid() and not public.is_blocked_pair(pr.id)
    and lower(p_interest) = any (pr.interests)
  order by pr.created_at desc
  limit least(p_limit, 30) offset p_offset;
$$;
grant execute on function public.search_profiles(text, int, int), public.trending_profiles(int, int),
  public.suggested_profiles(int), public.profiles_by_interest(text, int, int) to authenticated;
revoke execute on function public.search_profiles(text, int, int), public.trending_profiles(int, int),
  public.suggested_profiles(int), public.profiles_by_interest(text, int, int) from public, anon;

------------------------------------------------------------ NOTIFICATIONS
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  actor_id   uuid references public.profiles(id) on delete cascade,
  type       text not null check (type in ('follow','follow_request','follow_accepted','like','comment',
                                           'message_request','message','group_invite','reel_like','reel_comment')),
  entity_id  uuid,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists notif_user_idx   on public.notifications (user_id, created_at desc);
create index if not exists notif_unread_idx on public.notifications (user_id) where read_at is null;
alter table public.notifications enable row level security;
drop policy if exists notif_select on public.notifications;
drop policy if exists notif_update on public.notifications;
drop policy if exists notif_delete on public.notifications;
create policy notif_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_delete on public.notifications for delete to authenticated using (user_id = auth.uid());
revoke update on public.notifications from authenticated, anon;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.notify(p_user uuid, p_actor uuid, p_type text, p_entity uuid)
returns void language plpgsql security definer set search_path = public as $$
declare prefs jsonb; k text;
begin
  if p_user is null or p_user = p_actor then return; end if;
  if exists (select 1 from public.blocked_users
             where (blocker_id = p_user and blocked_id = p_actor) or (blocker_id = p_actor and blocked_id = p_user)) then return; end if;
  k := case p_type when 'follow' then 'follows' when 'follow_request' then 'requests' when 'follow_accepted' then 'requests'
         when 'like' then 'likes' when 'reel_like' then 'likes' when 'comment' then 'comments' when 'reel_comment' then 'comments'
         when 'message' then 'messages' when 'message_request' then 'messages' when 'group_invite' then 'groups' else 'other' end;
  select notif_prefs into prefs from public.profiles where id = p_user;
  if coalesce(prefs ->> k, 'true') = 'false' then return; end if;
  if p_type in ('message','message_request') then
    if exists (select 1 from public.notifications where user_id = p_user and type = p_type
               and entity_id is not distinct from p_entity and read_at is null) then return; end if;
  elsif p_type in ('like','reel_like','follow') then
    if exists (select 1 from public.notifications where user_id = p_user and actor_id = p_actor and type = p_type
               and entity_id is not distinct from p_entity) then return; end if;
  end if;
  insert into public.notifications (user_id, actor_id, type, entity_id) values (p_user, p_actor, p_type, p_entity);
end $$;
revoke all on function public.notify(uuid, uuid, text, uuid) from public, anon, authenticated;

create or replace function public.trg_follow_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify(new.following_id, new.follower_id,
            case when new.status = 'pending' then 'follow_request' else 'follow' end, null);
  elsif new.status = 'accepted' and old.status = 'pending' then
    perform public.notify(new.follower_id, new.following_id, 'follow_accepted', null);
  end if;
  return new;
end $$;
drop trigger if exists follows_notify_ins on public.follows;
create trigger follows_notify_ins after insert on public.follows for each row execute function public.trg_follow_notify();
drop trigger if exists follows_notify_upd on public.follows;
create trigger follows_notify_upd after update of status on public.follows for each row execute function public.trg_follow_notify();

create or replace function public.trg_post_like_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.notify((select author_id from public.posts where id = new.post_id), new.user_id, 'like', new.post_id); return new; end $$;
drop trigger if exists post_likes_notify on public.post_likes;
create trigger post_likes_notify after insert on public.post_likes for each row execute function public.trg_post_like_notify();

create or replace function public.trg_comment_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.notify((select author_id from public.posts where id = new.post_id), new.author_id, 'comment', new.post_id); return new; end $$;
drop trigger if exists comments_notify on public.comments;
create trigger comments_notify after insert on public.comments for each row execute function public.trg_comment_notify();

create or replace function public.trg_reel_like_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.notify((select author_id from public.reels where id = new.reel_id), new.user_id, 'reel_like', new.reel_id); return new; end $$;
drop trigger if exists reel_likes_notify on public.reel_likes;
create trigger reel_likes_notify after insert on public.reel_likes for each row execute function public.trg_reel_like_notify();

create or replace function public.trg_reel_comment_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.notify((select author_id from public.reels where id = new.reel_id), new.author_id, 'reel_comment', new.reel_id); return new; end $$;
drop trigger if exists reel_comments_notify on public.reel_comments;
create trigger reel_comments_notify after insert on public.reel_comments for each row execute function public.trg_reel_comment_notify();

create or replace function public.trg_invite_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'invited' then
    perform public.notify(new.user_id, (select created_by from public.conversations where id = new.conversation_id),
                          'group_invite', new.conversation_id);
  end if;
  return new;
end $$;
drop trigger if exists members_invite_notify on public.conversation_members;
create trigger members_invite_notify after insert on public.conversation_members for each row execute function public.trg_invite_notify();

------------------------------------------------------------ MODERATION
create table if not exists public.moderators (user_id uuid primary key references public.profiles(id) on delete cascade);
alter table public.moderators enable row level security;   -- no policies: managed in the Supabase dashboard only

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from public.moderators where user_id = auth.uid());
$$;
grant execute on function public.is_moderator() to authenticated;

alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('user','post','comment','reel','reel_comment'));

create or replace function public.report_queue()
returns table (id uuid, target_type text, target_id uuid, reason text, details text, created_at timestamptz,
               reporter text, preview text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_moderator() then raise exception 'forbidden'; end if;
  return query
    select r.id, r.target_type, r.target_id, r.reason, r.details, r.created_at, rp.username,
           case r.target_type
             when 'user'          then (select '@' || u.username from public.profiles u where u.id = r.target_id)
             when 'post'          then (select coalesce(p.body, '[photo]') from public.posts p where p.id = r.target_id)
             when 'comment'       then (select c.body from public.comments c where c.id = r.target_id)
             when 'reel'          then (select coalesce(x.caption, '[reel]') from public.reels x where x.id = r.target_id)
             when 'reel_comment'  then (select c.body from public.reel_comments c where c.id = r.target_id)
           end
    from public.reports r join public.profiles rp on rp.id = r.reporter_id
    where r.status = 'open' order by r.created_at limit 50;
end $$;

create or replace function public.moderate_report(p_report uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.reports;
begin
  if not public.is_moderator() then raise exception 'forbidden'; end if;
  select * into r from public.reports where id = p_report;
  if r.id is null then raise exception 'not_found'; end if;
  if p_action = 'remove' then
    if r.target_type = 'post' then delete from public.posts where id = r.target_id;
    elsif r.target_type = 'comment' then delete from public.comments where id = r.target_id;
    elsif r.target_type = 'reel' then delete from public.reels where id = r.target_id;
    elsif r.target_type = 'reel_comment' then delete from public.reel_comments where id = r.target_id;
    else raise exception 'cannot_remove_user'; end if;
    update public.reports set status = 'actioned' where id = p_report;
  elsif p_action = 'reviewed' then update public.reports set status = 'reviewed' where id = p_report;
  elsif p_action = 'dismiss' then update public.reports set status = 'dismissed' where id = p_report;
  else raise exception 'invalid'; end if;
end $$;
grant execute on function public.report_queue(), public.moderate_report(uuid, text) to authenticated;
revoke execute on function public.report_queue(), public.moderate_report(uuid, text) from public, anon;

------------------------------------------------------------ REALTIME
do $$ declare t text; begin
  foreach t in array array['messages','message_reactions','notifications','conversation_members'] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;
