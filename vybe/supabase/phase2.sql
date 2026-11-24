-- VYBE Phase 2: profiles, username rules, avatars, account deletion
-- Run this whole file once in Supabase > SQL Editor.

create or replace function public.is_reserved_username(u text)
returns boolean language sql immutable as $$
  select u = any (array['admin','vybe','support','help','settings','login','signup','api','root','u','profile','explore','reels','chats','moderator','official']);
$$;

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null unique,
  display_name text not null,
  bio          text,
  interests    text[] not null default '{}',
  mood         text,
  avatar_url   text,
  is_private   boolean not null default false,
  theme        jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint username_format   check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint username_reserved check (not public.is_reserved_username(username)),
  constraint display_len       check (char_length(display_name) between 1 and 40),
  constraint bio_len           check (bio is null or char_length(bio) <= 160),
  constraint mood_len          check (mood is null or char_length(mood) <= 40),
  constraint interests_len     check (cardinality(interests) <= 8)
);
create index if not exists profiles_created_idx on public.profiles (created_at desc);

alter table public.profiles enable row level security;

-- Public profiles are readable by everyone; private ones only by the owner.
-- (Phase 3 will also let approved followers read private profiles.)
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (is_private = false or id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- No client INSERT/DELETE policy. Rows are created by the trigger below.
-- Users may edit only these columns (username and id are locked).
revoke update on public.profiles from authenticated, anon;
grant update (display_name, bio, interests, mood, avatar_url, is_private, theme)
  on public.profiles to authenticated;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Auto-create a profile when someone signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare uname text := lower(new.raw_user_meta_data->>'username');
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, uname,
          coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), uname));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Live username check used by the signup form (works before login).
create or replace function public.username_available(name text)
returns boolean language sql stable security definer set search_path = public as $$
  select name ~ '^[a-z0-9_]{3,20}$'
     and not public.is_reserved_username(name)
     and not exists (select 1 from public.profiles where username = name);
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- Account deletion (removes the user; the profile row cascades).
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Avatar storage: public read, 2 MB, images only, each user writes only to own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_insert on storage.objects;
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
