-- QUIZVERSE: Learning Quest + Collaborative Challenge.
-- Run once in Supabase SQL Editor after teacher.sql. Safe to run again.

-- ───── Learning Quest: shared question bank per subject and stage (filled by AI on demand, then reused)
create table if not exists public.quest_questions (
  id         uuid primary key default gen_random_uuid(),
  subject    text not null,
  stage      smallint not null check (stage between 1 and 5),
  q          text not null,
  choices    jsonb not null check (jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) = 4),
  answer     smallint not null check (answer between 0 and 3),
  explain    text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists quest_questions_stage_idx on public.quest_questions (subject, stage);
alter table public.quest_questions enable row level security; -- server only

-- ───── Collaborative Challenge: team mode for live rooms
alter table public.live_rooms   add column if not exists team_mode boolean not null default false;
alter table public.live_players add column if not exists team smallint;
alter table public.live_answers add column if not exists reason text check (reason is null or char_length(reason) <= 300);
