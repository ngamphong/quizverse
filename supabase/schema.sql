-- QUIZVERSE database schema
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste this file → Run.
-- Safe to run again (uses IF NOT EXISTS / OR REPLACE).
-- After this, also run supabase/seed.sql to add the sample room (PIN 587421).

create extension if not exists pgcrypto;

-- ───────────────────────── profiles (one per user, holds Learning DNA) ─────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'ผู้เรียน' check (char_length(display_name) between 1 and 40),
  role         text not null default 'student' check (role in ('student', 'teacher')),
  learning     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

-- create the profile automatically when someone signs up
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(nullif(left(trim(new.raw_user_meta_data ->> 'display_name'), 40), ''), split_part(new.email, '@', 1)),
    case when new.raw_user_meta_data ->> 'role' = 'teacher' then 'teacher' else 'student' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── quizzes & questions ─────────────────────────
create table if not exists public.quizzes (
  id         uuid primary key default gen_random_uuid(),
  pin        text not null unique check (pin ~ '^[0-9]{6}$'),
  title      text not null check (char_length(title) between 1 and 120),
  owner_id   uuid references auth.users (id) on delete cascade,
  is_sample  boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id       uuid primary key default gen_random_uuid(),
  quiz_id  uuid not null references public.quizzes (id) on delete cascade,
  position int not null,
  topic    text not null,
  level    smallint not null check (level between 1 and 3),
  q        text not null,
  choices  jsonb not null check (jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) = 4),
  answer   smallint not null check (answer between 0 and 3),
  explain  text not null default ''
);
create index if not exists questions_quiz_idx on public.questions (quiz_id, position);

-- ───────────────────────── games (written only by the server) ─────────────────────────
create table if not exists public.game_sessions (
  id                 uuid primary key default gen_random_uuid(),
  token              text not null,
  quiz_id            uuid not null references public.quizzes (id) on delete cascade,
  user_id            uuid references auth.users (id) on delete set null,
  nickname           text not null,
  total              int not null,
  level              smallint not null default 2,
  prev_level         smallint not null default 2,
  streak             int not null default 0,
  max_level          smallint not null default 1,
  score              int not null default 0,
  asked              uuid[] not null default '{}',
  current_question   uuid,
  current_started_at timestamptz,
  current_answered   boolean not null default true,
  finished_at        timestamptz,
  result             jsonb,
  created_at         timestamptz not null default now()
);
create index if not exists game_sessions_quiz_idx on public.game_sessions (quiz_id, created_at desc);

create table if not exists public.answers (
  id          bigint generated always as identity primary key,
  session_id  uuid not null references public.game_sessions (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  choice      smallint not null check (choice between -1 and 3),
  confidence  text not null check (confidence in ('sure', 'mid', 'guess', 'none')),
  correct     boolean not null,
  points      int not null,
  answered_at timestamptz not null default now()
);
create index if not exists answers_session_idx on public.answers (session_id);

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.profiles      enable row level security;
alter table public.quizzes       enable row level security;
alter table public.questions     enable row level security;
alter table public.game_sessions enable row level security;  -- no policies: server (secret key) only
alter table public.answers       enable row level security;  -- no policies: server (secret key) only

-- profiles: read and update your own row; you can never change your own role
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
revoke update on public.profiles from anon, authenticated;
grant update (display_name, learning) on public.profiles to authenticated;

-- quizzes: everyone sees the sample room; teachers see and manage their own
drop policy if exists "read sample or own quizzes" on public.quizzes;
create policy "read sample or own quizzes" on public.quizzes for select to anon, authenticated
  using (is_sample or owner_id = (select auth.uid()));
drop policy if exists "teachers create quizzes" on public.quizzes;
create policy "teachers create quizzes" on public.quizzes for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and not is_sample
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'teacher')
  );
drop policy if exists "owners update quizzes" on public.quizzes;
create policy "owners update quizzes" on public.quizzes for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()) and not is_sample);
drop policy if exists "owners delete quizzes" on public.quizzes;
create policy "owners delete quizzes" on public.quizzes for delete to authenticated
  using (owner_id = (select auth.uid()));

-- questions (contain the answer key): only the quiz owner may touch them directly.
-- Students get questions through the server game API, which hides the answer until they reply.
drop policy if exists "owners manage questions" on public.questions;
create policy "owners manage questions" on public.questions for all to authenticated
  using (exists (select 1 from public.quizzes z where z.id = quiz_id and z.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.quizzes z where z.id = quiz_id and z.owner_id = (select auth.uid())));
