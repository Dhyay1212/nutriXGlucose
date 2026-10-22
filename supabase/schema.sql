-- NutriX Glucose: run this in Supabase → SQL Editor.
create table if not exists profiles (
  id text primary key,          -- pilot ID, e.g. P01
  name text not null
);

create table if not exists meals (
  id uuid primary key,
  user_id text not null references profiles(id) on delete cascade,
  eaten_at timestamptz not null,
  items jsonb not null,         -- [{dishId, name, aiName, portion, confidence}]
  photo text,                   -- small JPEG data URL thumbnail
  totals jsonb not null,        -- {kcal, carbs, protein, fat, fibre}
  log_seconds int,              -- seconds to log the meal (pilot metric)
  source text,                  -- 'photo' or 'manual'
  created_at timestamptz not null default now()
);
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

-- HACKATHON ONLY: open access with the anon key so the demo works without login.
-- Before real patients use this, add Supabase Auth and replace these with per-user policies.
alter table profiles enable row level security;
alter table meals enable row level security;
alter table readings enable row level security;
alter table notes enable row level security;
create policy "demo all profiles" on profiles for all using (true) with check (true);
create policy "demo all meals" on meals for all using (true) with check (true);
create policy "demo all readings" on readings for all using (true) with check (true);
create policy "demo all notes" on notes for all using (true) with check (true);
