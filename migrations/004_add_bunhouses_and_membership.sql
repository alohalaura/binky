-- Bunhouse multi-user sharing: add bunhouses + membership and backfill existing data.
-- This migration is designed to be safe to run on an existing project.

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table if not exists public.bunhouses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists public.bunhouse_members (
  bunhouse_id uuid references public.bunhouses(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (bunhouse_id, user_id)
);

-- -----------------------------------------------------------------------------
-- bunnies.bunhouse_id + FK
-- -----------------------------------------------------------------------------
alter table public.bunnies
  add column if not exists bunhouse_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bunnies_bunhouse_id_fkey'
  ) then
    alter table public.bunnies
      add constraint bunnies_bunhouse_id_fkey
      foreign key (bunhouse_id) references public.bunhouses(id) on delete cascade;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Backfill: create one bunhouse per existing owner_id, then attach bunnies to it.
-- -----------------------------------------------------------------------------
create temporary table tmp_owner_bunhouse (
  user_id uuid primary key,
  bunhouse_id uuid not null
);

insert into tmp_owner_bunhouse (user_id, bunhouse_id)
select o.owner_id as user_id, gen_random_uuid() as bunhouse_id
from (
  select distinct b.owner_id
  from public.bunnies b
  where b.bunhouse_id is null
    and b.owner_id is not null
) o;

insert into public.bunhouses (id, name)
select t.bunhouse_id, 'My Bunhouse'
from tmp_owner_bunhouse t
on conflict (id) do nothing;

insert into public.bunhouse_members (bunhouse_id, user_id)
select t.bunhouse_id, t.user_id
from tmp_owner_bunhouse t
on conflict (bunhouse_id, user_id) do nothing;

update public.bunnies b
set bunhouse_id = t.bunhouse_id
from tmp_owner_bunhouse t
where b.owner_id = t.user_id
  and b.bunhouse_id is null;

drop table tmp_owner_bunhouse;

-- -----------------------------------------------------------------------------
-- RLS enablement for new tables (policies are defined in schema.sql)
-- -----------------------------------------------------------------------------
alter table public.bunhouses enable row level security;
alter table public.bunhouse_members enable row level security;

-- -----------------------------------------------------------------------------
-- Baseline privileges for PostgREST (RLS still applies)
-- -----------------------------------------------------------------------------
grant select, insert, update, delete on table
  public.bunhouses,
  public.bunhouse_members
to authenticated;

