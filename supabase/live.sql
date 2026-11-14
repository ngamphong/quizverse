-- QUIZVERSE phase 4: live multi-device rooms.
-- Run once in Supabase SQL Editor after schema.sql. Safe to run again.
-- All three tables are written and read only by the server (secret key); RLS has no policies on purpose.

create table if not exists public.live_rooms (
  id                  uuid primary key default gen_random_uuid(),
  pin                 text not null check (pin ~ '^[0-9]{6}$'),
  quiz_id             uuid not null references public.quizzes (id) on delete cascade,
  host_id             uuid not null references auth.users (id) on delete cascade,
  state               text not null default 'lobby' check (state in ('lobby', 'question', 'reveal', 'ended')),
  question_ids        uuid[] not null default '{}',   -- order fixed when the host presses start
  current_index       int not null default -1,
  question_started_at timestamptz,
  created_at          timestamptz not null default now(),
  ended_at            timestamptz
);
-- a PIN is unique among rooms that are still running
create unique index if not exists live_rooms_active_pin on public.live_rooms (pin) where state <> 'ended';
create index if not exists live_rooms_host_idx on public.live_rooms (host_id, created_at desc);

create table if not exists public.live_players (
  id        uuid primary key default gen_random_uuid(),
  room_id   uuid not null references public.live_rooms (id) on delete cascade,
  user_id   uuid references auth.users (id) on delete set null,
  nickname  text not null check (char_length(nickname) between 1 and 20),
  token     text not null,
  score     int not null default 0,
  joined_at timestamptz not null default now(),
  unique (room_id, nickname)
);

create table if not exists public.live_answers (
  id          bigint generated always as identity primary key,
  room_id     uuid not null references public.live_rooms (id) on delete cascade,
  player_id   uuid not null references public.live_players (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  choice      smallint not null check (choice between -1 and 3),
  confidence  text not null check (confidence in ('sure', 'mid', 'guess', 'none')),
  correct     boolean not null,
  points      int not null,
  answered_at timestamptz not null default now(),
  unique (player_id, question_id)   -- one answer per player per question, enforced by the database
);
create index if not exists live_answers_room_q on public.live_answers (room_id, question_id);

alter table public.live_rooms   enable row level security;
alter table public.live_players enable row level security;
alter table public.live_answers enable row level security;
