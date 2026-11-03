-- HRID FleetFlow – run in the Supabase SQL editor. Safe to run again (it only adds what is missing).
create table if not exists users               (id text primary key, data jsonb not null, created_at timestamptz default now());
create table if not exists trips               (id text primary key, data jsonb not null, created_at timestamptz default now());
create table if not exists trip_requests       (id text primary key, data jsonb not null, created_at timestamptz default now());
create table if not exists vehicle_inspections (id text primary key, data jsonb not null, created_at timestamptz default now());
create table if not exists vehicle_issues      (id text primary key, data jsonb not null, created_at timestamptz default now());
create table if not exists email_outbox        (id text primary key, data jsonb not null, created_at timestamptz default now());

-- One weekly checklist per driver per vehicle per week.
create unique index if not exists one_inspection_per_week
  on vehicle_inspections ((data->>'driver_id'), (data->>'vehicle_number'), (data->>'week_key'));

-- The app signs users in itself, so the anon key needs read/write access.
-- See README "Security" before going live.
do $$ declare t text; begin
  foreach t in array array['users','trips','trip_requests','vehicle_inspections','vehicle_issues','email_outbox'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "app access" on %I', t);
    execute format('create policy "app access" on %I for all to anon using (true) with check (true)', t);
  end loop;
end $$;
