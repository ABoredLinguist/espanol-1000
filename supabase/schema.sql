-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- One row per user holding their whole progress (about 100 KB at most).
create table if not exists public.progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

-- Each signed-in person can only see and change their own row.
create policy "read own progress" on public.progress
  for select using (auth.uid() = user_id);
create policy "insert own progress" on public.progress
  for insert with check (auth.uid() = user_id);
create policy "update own progress" on public.progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
