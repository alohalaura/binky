-- Medical Records Vault — run once in Supabase: SQL Editor → New query → Run
-- Fixes: "visit_type column ... not in schema cache" and
--         "relationship between medical_records and medical_record_files"

-- 1) Visit type (physical / online) on each medical record row
alter table public.medical_records
  add column if not exists visit_type text;

-- Optional: enforce allowed values (skip if this errors on your DB)
do $$
begin
  alter table public.medical_records
    add constraint medical_records_visit_type_check
    check (visit_type is null or visit_type in ('physical', 'online'));
exception
  when duplicate_object then null;
end $$;

-- 2) Per-file rows (typed attachments)
create table if not exists public.medical_record_files (
  id uuid primary key default gen_random_uuid(),
  medical_record_id uuid not null references public.medical_records (id) on delete cascade,
  storage_path text not null,
  file_kind text not null check (
    file_kind in ('xray', 'blood_work', 'prescription', 'vaccination', 'bill', 'fecal_test')
  ),
  created_at timestamptz default now()
);

create index if not exists medical_record_files_medical_record_id_idx
  on public.medical_record_files (medical_record_id);

alter table public.medical_record_files enable row level security;

-- 3) RLS (same ownership pattern as other bunny-scoped tables)
drop policy if exists "owner_select" on public.medical_record_files;
create policy "owner_select" on public.medical_record_files
for select using (
  exists (
    select 1
    from public.medical_records mr
    join public.bunnies b on b.id = mr.bunny_id
    where mr.id = medical_record_files.medical_record_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from public.bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_insert" on public.medical_record_files;
create policy "owner_insert" on public.medical_record_files
for insert with check (
  exists (
    select 1
    from public.medical_records mr
    join public.bunnies b on b.id = mr.bunny_id
    where mr.id = medical_record_files.medical_record_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from public.bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_update" on public.medical_record_files;
create policy "owner_update" on public.medical_record_files
for update using (
  exists (
    select 1
    from public.medical_records mr
    join public.bunnies b on b.id = mr.bunny_id
    where mr.id = medical_record_files.medical_record_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from public.bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_delete" on public.medical_record_files;
create policy "owner_delete" on public.medical_record_files
for delete using (
  exists (
    select 1
    from public.medical_records mr
    join public.bunnies b on b.id = mr.bunny_id
    where mr.id = medical_record_files.medical_record_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from public.bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

-- 4) API access for authenticated users (RLS still applies)
grant select, insert, update, delete on table public.medical_record_files to authenticated;

-- 5) Visit / consult cost (optional amount + currency; default currency PHP)
alter table public.medical_records add column if not exists visit_cost_amount numeric;
alter table public.medical_records add column if not exists visit_cost_currency text;
alter table public.medical_records
  alter column visit_cost_currency set default 'PHP';

-- 6) Invoice-style line items for visit cost
create table if not exists public.medical_record_cost_items (
  id uuid primary key default gen_random_uuid(),
  medical_record_id uuid not null references public.medical_records (id) on delete cascade,
  description text not null,
  amount numeric not null check (amount >= 0),
  created_at timestamptz default now()
);

create index if not exists medical_record_cost_items_medical_record_id_idx
  on public.medical_record_cost_items (medical_record_id);

alter table public.medical_record_cost_items enable row level security;

drop policy if exists "owner_select" on public.medical_record_cost_items;
create policy "owner_select" on public.medical_record_cost_items
for select using (
  exists (
    select 1
    from public.medical_records mr
    join public.bunnies b on b.id = mr.bunny_id
    where mr.id = medical_record_cost_items.medical_record_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from public.bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_insert" on public.medical_record_cost_items;
create policy "owner_insert" on public.medical_record_cost_items
for insert with check (
  exists (
    select 1
    from public.medical_records mr
    join public.bunnies b on b.id = mr.bunny_id
    where mr.id = medical_record_cost_items.medical_record_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from public.bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_update" on public.medical_record_cost_items;
create policy "owner_update" on public.medical_record_cost_items
for update using (
  exists (
    select 1
    from public.medical_records mr
    join public.bunnies b on b.id = mr.bunny_id
    where mr.id = medical_record_cost_items.medical_record_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from public.bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

drop policy if exists "owner_delete" on public.medical_record_cost_items;
create policy "owner_delete" on public.medical_record_cost_items
for delete using (
  exists (
    select 1
    from public.medical_records mr
    join public.bunnies b on b.id = mr.bunny_id
    where mr.id = medical_record_cost_items.medical_record_id
      and b.bunhouse_id is not null
      and exists (
        select 1 from public.bunhouse_members m
        where m.bunhouse_id = b.bunhouse_id
          and m.user_id = auth.uid()
      )
  )
);

grant select, insert, update, delete on table public.medical_record_cost_items to authenticated;

-- 7) Allow deleting a medical_record without breaking linked tables
-- If a prescription/expense links to a medical record, keep the row but clear the link.
do $$
begin
  alter table public.prescriptions
    drop constraint if exists prescriptions_record_id_fkey;
  alter table public.prescriptions
    add constraint prescriptions_record_id_fkey
    foreign key (record_id) references public.medical_records(id) on delete set null;
exception
  when undefined_table then null;
end $$;

do $$
begin
  alter table public.expenses
    drop constraint if exists expenses_record_id_fkey;
  alter table public.expenses
    add constraint expenses_record_id_fkey
    foreign key (record_id) references public.medical_records(id) on delete set null;
exception
  when undefined_table then null;
end $$;

-- After success: refresh the app. If errors persist ~1–2 min, in Dashboard try
-- Project Settings → API → (reload) or redeploy; PostgREST caches the schema.
