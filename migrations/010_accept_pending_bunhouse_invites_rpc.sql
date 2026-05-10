-- Server-side invite accept: bypasses fragile client RLS/email/JWT mismatch and FK ordering.
-- Caller must be authenticated. Uses auth.users email (authoritative), not only JWT claims.

create or replace function public.accept_pending_bunhouse_invites()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_full text;
begin
  if v_uid is null then
    return;
  end if;

  select lower(nullif(trim(u.email), '')), coalesce(u.raw_user_meta_data ->> 'full_name', null)
  into v_email, v_full
  from auth.users u
  where u.id = v_uid;

  if v_email is null or v_email = '' then
    return;
  end if;

  insert into public.profiles (id, email, full_name)
  values (v_uid, v_email, v_full)
  on conflict (id) do update
  set
    email = coalesce(excluded.email, public.profiles.email),
    full_name = coalesce(excluded.full_name, public.profiles.full_name);

  insert into public.bunhouse_members (bunhouse_id, user_id)
  select bi.bunhouse_id, v_uid
  from public.bunhouse_invites bi
  where bi.accepted_at is null
    and lower(nullif(trim(bi.email), '')) = v_email
  on conflict (bunhouse_id, user_id) do nothing;

  update public.bunhouse_invites bi
  set
    accepted_at = now(),
    accepted_by = v_uid
  where bi.accepted_at is null
    and lower(nullif(trim(bi.email), '')) = v_email
    and exists (
      select 1
      from public.bunhouse_members m
      where m.bunhouse_id = bi.bunhouse_id
        and m.user_id = v_uid
    );
end;
$$;

revoke all on function public.accept_pending_bunhouse_invites() from public;
grant execute on function public.accept_pending_bunhouse_invites() to authenticated;
