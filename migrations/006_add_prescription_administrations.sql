-- Run once in Supabase: SQL Editor -> New query -> paste -> Run

create table if not exists public.prescription_administrations (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  bunny_id uuid not null references public.bunnies(id) on delete cascade,
  administered_on date not null default current_date,
  administered_at timestamptz not null default now(),
  created_at timestamptz default now(),
  unique (prescription_id, administered_on)
);

create index if not exists prescription_administrations_bunny_administered_at_idx
  on public.prescription_administrations (bunny_id, administered_at desc);

alter table public.prescription_administrations enable row level security;

drop policy if exists "owner_select" on public.prescription_administrations;
create policy "owner_select" on public.prescription_administrations
for select using (
  exists (
    select 1 from public.bunnies b
    where b.id = prescription_administrations.bunny_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from public.bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_insert" on public.prescription_administrations;
create policy "owner_insert" on public.prescription_administrations
for insert with check (
  exists (
    select 1 from public.bunnies b
    where b.id = prescription_administrations.bunny_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from public.bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_update" on public.prescription_administrations;
create policy "owner_update" on public.prescription_administrations
for update using (
  exists (
    select 1 from public.bunnies b
    where b.id = prescription_administrations.bunny_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from public.bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_delete" on public.prescription_administrations;
create policy "owner_delete" on public.prescription_administrations
for delete using (
  exists (
    select 1 from public.bunnies b
    where b.id = prescription_administrations.bunny_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from public.bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

grant select, insert, update, delete on table public.prescription_administrations to authenticated;
