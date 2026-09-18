-- Run this in Supabase > SQL Editor once.
create table if not exists public.draft_picks (
  id uuid primary key default gen_random_uuid(),
  pick_number integer not null unique check (pick_number between 1 and 18),
  owner text not null check (owner in ('Dave','Jaz','Brody','Bo','Sarah','Mike')),
  contestant text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.score_events (
  id uuid primary key default gen_random_uuid(),
  contestant text not null,
  event_type text not null,
  episode integer not null default 1,
  quantity integer not null default 1,
  points integer not null,
  note text default '',
  created_at timestamptz not null default now()
);

alter table public.draft_picks enable row level security;
alter table public.score_events enable row level security;

-- Simple friends-and-family pool policies. Anyone with the site URL can read/write.
-- For a private/locked-down version, replace these with Supabase Auth policies.
create policy "public read draft" on public.draft_picks for select using (true);
create policy "public insert draft" on public.draft_picks for insert with check (true);
create policy "public delete draft" on public.draft_picks for delete using (true);
create policy "public read scores" on public.score_events for select using (true);
create policy "public insert scores" on public.score_events for insert with check (true);
create policy "public delete scores" on public.score_events for delete using (true);

alter publication supabase_realtime add table public.draft_picks;
alter publication supabase_realtime add table public.score_events;
