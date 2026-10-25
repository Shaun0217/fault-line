-- Fault Line: saved household profiles. RLS on from day one.
-- Stores a derived site profile and rounded coordinates, never a street address.

create table if not exists public.household_profiles (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  label       text not null check (char_length(label) <= 80),
  lat         double precision not null,
  lon         double precision not null,
  site_class  text not null check (site_class in ('A','B','C','D','E')),
  vs30_ms     double precision not null,
  household   jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.household_profiles enable row level security;

create policy "owner can read"   on public.household_profiles for select using (auth.uid() = user_id);
create policy "owner can insert" on public.household_profiles for insert with check (auth.uid() = user_id);
create policy "owner can update" on public.household_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner can delete" on public.household_profiles for delete using (auth.uid() = user_id);

create index if not exists household_profiles_user_idx on public.household_profiles (user_id, updated_at desc);
