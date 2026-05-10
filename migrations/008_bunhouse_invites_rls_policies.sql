-- Migration 005 enabled RLS on bunhouse_invites but did not attach policies,
-- so Postgres denied all access: invitees could not read/update pending invites,
-- and auto-accept on login never inserted bunhouse_members.
-- Mirrors schema.sql helpers + bunhouse_invites policies only.

create or replace function public.is_bunhouse_member(target_bunhouse_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bunhouse_members m
    where m.bunhouse_id = target_bunhouse_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.auth_email()
returns text
language sql
stable
as $$
  select lower(nullif(auth.jwt() ->> 'email', ''));
$$;

drop policy if exists "member_or_invitee_select" on public.bunhouse_invites;
create policy "member_or_invitee_select" on public.bunhouse_invites
for select using (
  public.is_bunhouse_member(bunhouse_invites.bunhouse_id)
  or (
    public.auth_email() is not null
    and lower(bunhouse_invites.email) = public.auth_email()
  )
);

drop policy if exists "member_insert" on public.bunhouse_invites;
create policy "member_insert" on public.bunhouse_invites
for insert with check (
  public.is_bunhouse_member(bunhouse_invites.bunhouse_id)
);

drop policy if exists "member_delete" on public.bunhouse_invites;
create policy "member_delete" on public.bunhouse_invites
for delete using (
  public.is_bunhouse_member(bunhouse_invites.bunhouse_id)
);

drop policy if exists "invited_accept_update" on public.bunhouse_invites;
create policy "invited_accept_update" on public.bunhouse_invites
for update using (
  bunhouse_invites.accepted_at is null
  and public.auth_email() is not null
  and lower(bunhouse_invites.email) = public.auth_email()
)
with check (
  bunhouse_invites.accepted_at is not null
  and bunhouse_invites.accepted_by = auth.uid()
);
