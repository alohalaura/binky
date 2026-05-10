-- bunhouse_members.user_id and bunhouse_invites.accepted_by reference profiles(id).
-- Without a profile row, invite accept fails on FK and users stay stuck on onboarding.
-- schema.sql assumed this existed; migrations never added it earlier.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', null)
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into public.profiles (id, email, full_name)
select u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', null)
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;
