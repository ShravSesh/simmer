-- Simmer — Supabase schema
-- Run this in the Supabase SQL Editor (one time, on a fresh project).
-- Mirrors the live "Simmer" project as of 2026-08-24.

create table if not exists kv (
  k          text primary key,
  v          jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table kv enable row level security;

-- The app talks to this table with the anon key only, and never deletes.
-- storage.js does: select (read), upsert (insert + update). Nothing else.
-- Granting only those three verbs keeps DELETE off the table entirely.
create policy "anon can read"   on kv for select using (true);
create policy "anon can insert" on kv for insert with check (true);
create policy "anon can update" on kv for update using (true);

-- Realtime: push household changes to other devices instead of polling.
-- The client subscribes to postgres_changes on the five hh:CODE:* keys.
alter publication supabase_realtime add table public.kv;

-- Filters on UPDATE/DELETE match against the replicated row. `k` is the
-- primary key so it would be replicated either way, but FULL keeps filter
-- behaviour predictable if a non-key filter is ever added. The table holds a
-- handful of small rows, so the extra WAL is immaterial.
alter table public.kv replica identity full;
