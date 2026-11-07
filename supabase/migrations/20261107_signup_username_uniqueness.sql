do $migration$
declare
  duplicate_usernames text;
begin
  select string_agg(
    format('%s (%s Konten)', username_key, account_count),
    ', ' order by username_key
  )
  into duplicate_usernames
  from (
    select lower(btrim(raw_user_meta_data ->> 'username')) as username_key, count(*) as account_count
    from auth.users
    where nullif(btrim(raw_user_meta_data ->> 'username'), '') is not null
    group by lower(btrim(raw_user_meta_data ->> 'username'))
    having count(*) > 1
  ) duplicates;

  if duplicate_usernames is not null then
    raise exception 'Doppelte Usernames verhindern die Migration: %', duplicate_usernames
      using hint = 'Doppelte Usernames müssen manuell geklärt werden; diese Migration ändert oder löscht keine Nutzerdaten.';
  end if;
end
$migration$;

create or replace function public.is_username_available(candidate_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when candidate_username is null
      or nullif(pg_catalog.btrim(candidate_username), '') is null
      or pg_catalog.char_length(pg_catalog.btrim(candidate_username)) > 100
      or pg_catalog.strpos(pg_catalog.btrim(candidate_username), '@') > 0
    then false
    else not exists (
      select 1
      from public.username_claims claim
      where claim.username_key = pg_catalog.lower(pg_catalog.btrim(candidate_username))
    )
  end;
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

create or replace function public.create_profile_for_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'username'), ''),
      'Nutzer'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.create_profile_for_new_auth_user() from public, anon, authenticated;

drop trigger if exists create_profile_for_new_auth_user on auth.users;
create trigger create_profile_for_new_auth_user
after insert on auth.users
for each row execute function public.create_profile_for_new_auth_user();
