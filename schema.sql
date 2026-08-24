-- Run this in Supabase SQL Editor (one time)
create table if not exists kv (
  k text primary key,
  v jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
alter table kv enable row level security;
create policy "Public read/write" on kv for all using (true) with check (true);
