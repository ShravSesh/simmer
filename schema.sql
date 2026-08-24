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
