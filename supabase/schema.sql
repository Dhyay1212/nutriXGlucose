-- NutriX Glucose: run this whole file in Supabase → SQL Editor. Safe to re-run.
-- Login: Supabase Auth (email magic link). Each participant sees only their own data;
-- educators (role = 'educator') can read everyone's data and write review notes.

create table if not exists profiles (
  id text primary key,                 -- pilot ID, e.g. P01
  name text not null
);
alter table profiles add column if not exists auth_id uuid unique references auth.users(id) on delete set null;
alter table profiles add column if not exists role text not null default 'participant';
alter table profiles add column if not exists consent_at timestamptz;
alter table profiles add column if not exists created_at timestamptz not null default now();
do $$ begin
  alter table profiles add constraint profiles_role_check check (role in ('participant', 'educator'));
exception when duplicate_object then null; end $$;

create table if not exists meals (
  id uuid primary key,
  user_id text not null references profiles(id) on delete cascade,
  eaten_at timestamptz not null,
  items jsonb not null,                -- [{dishId, name, aiName, portion, confidence, custom?}]
  photo text,                          -- small JPEG data URL thumbnail
  totals jsonb not null,               -- {kcal, carbs, protein, fat, fibre}
  created_at timestamptz not null default now()
);
alter table meals add column if not exists log_seconds int;
alter table meals add column if not exists source text;
alter table meals add column if not exists tags jsonb not null default '[]';
create index if not exists meals_user_time on meals(user_id, eaten_at);

create table if not exists readings (
  id uuid primary key,
  user_id text not null references profiles(id) on delete cascade,
  taken_at timestamptz not null,
  mgdl int not null check (mgdl between 20 and 600),
  created_at timestamptz not null default now()
);
create index if not exists readings_user_time on readings(user_id, taken_at);

create table if not exists notes (
  id uuid primary key,
  user_id text not null references profiles(id) on delete cascade,
  week_start date not null,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists educator_notes (
  id uuid primary key,
  user_id text not null references profiles(id) on delete cascade,
  author text not null,
  text text not null,
  created_at timestamptz not null default now()
);

-- ---------- helpers (security definer so policies don't recurse) ----------
create or replace function is_educator() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where auth_id = auth.uid() and role = 'educator');
$$;

create or replace function owns_profile(pid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = pid and auth_id = auth.uid());
$$;

-- ---------- row level security ----------
alter table profiles enable row level security;
alter table meals enable row level security;
alter table readings enable row level security;
alter table notes enable row level security;
alter table educator_notes enable row level security;

-- remove the old open hackathon policies
drop policy if exists "demo all profiles" on profiles;
drop policy if exists "demo all meals" on meals;
drop policy if exists "demo all readings" on readings;
drop policy if exists "demo all notes" on notes;

drop policy if exists "profiles read" on profiles;
drop policy if exists "profiles insert own" on profiles;
drop policy if exists "profiles update own" on profiles;
drop policy if exists "profiles delete own" on profiles;
create policy "profiles read" on profiles for select using (auth_id = auth.uid() or is_educator());
create policy "profiles insert own" on profiles for insert with check (auth_id = auth.uid() and role = 'participant');
create policy "profiles update own" on profiles for update using (auth_id = auth.uid())
  with check (auth_id = auth.uid() and role = (select p.role from profiles p where p.id = profiles.id));
create policy "profiles delete own" on profiles for delete using (auth_id = auth.uid());

-- meals / readings / notes: owner full access, educators read-only
do $$
declare t text;
begin
  foreach t in array array['meals', 'readings', 'notes'] loop
    execute format('drop policy if exists "%1$s owner" on %1$I', t);
    execute format('drop policy if exists "%1$s educator read" on %1$I', t);
    execute format('create policy "%1$s owner" on %1$I for all using (owns_profile(user_id)) with check (owns_profile(user_id))', t);
    execute format('create policy "%1$s educator read" on %1$I for select using (is_educator())', t);
  end loop;
end $$;

-- educator review notes: educators full access; the participant can read and delete notes about them
drop policy if exists "edu notes educator" on educator_notes;
drop policy if exists "edu notes participant read" on educator_notes;
drop policy if exists "edu notes participant delete" on educator_notes;
create policy "edu notes educator" on educator_notes for all using (is_educator()) with check (is_educator());
create policy "edu notes participant read" on educator_notes for select using (owns_profile(user_id));
create policy "edu notes participant delete" on educator_notes for delete using (owns_profile(user_id));

-- ---------- making someone an educator ----------
-- 1. The educator signs in once and creates a profile (e.g. pilot ID EDU1).
-- 2. Run:  update profiles set role = 'educator' where id = 'EDU1';
