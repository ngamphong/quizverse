-- QUIZVERSE phase 5: teacher tools (question images, reports).
-- Run once in Supabase SQL Editor after live.sql. Safe to run again.

-- optional picture for each question (public URL in our own storage bucket)
alter table public.questions add column if not exists image_url text
  check (image_url is null or image_url ~ '^https://');

-- public bucket for question pictures: anyone can view, only the server (secret key) can upload
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('question-images', 'question-images', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- faster reports
create index if not exists live_rooms_quiz_idx on public.live_rooms (quiz_id);
create index if not exists live_answers_player_idx on public.live_answers (player_id);
