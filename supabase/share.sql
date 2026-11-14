-- QUIZVERSE: featured quizzes on the home page (opt-in by the teacher who made them).
-- Run once in Supabase SQL Editor after quest-team.sql. Safe to run again.

alter table public.quizzes add column if not exists is_public   boolean not null default false; -- teacher agreed to list it on the home page
alter table public.quizzes add column if not exists show_author boolean not null default true;  -- teacher agreed to show their name
alter table public.quizzes add column if not exists shared_at   timestamptz;

create index if not exists quizzes_public_idx on public.quizzes (is_public, shared_at desc) where is_public;

-- anyone may see shared quizzes' titles and PINs (questions stay owner-only; players get them through the game API)
drop policy if exists "read sample or own quizzes" on public.quizzes;
create policy "read sample, shared or own quizzes" on public.quizzes for select to anon, authenticated
  using (is_sample or is_public or owner_id = (select auth.uid()));
