-- Reserve usernames in an application-owned table. Auth metadata alone is editable
-- by the user and does not provide a uniqueness constraint.
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

create table public.username_claims (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (nullif(btrim(username), '') is not null),
  username_key text generated always as (lower(btrim(username))) stored unique
);

alter table public.username_claims enable row level security;
revoke all on public.username_claims from public, anon, authenticated;

insert into public.username_claims (user_id, username)
select id, btrim(raw_user_meta_data ->> 'username')
from auth.users
where nullif(btrim(raw_user_meta_data ->> 'username'), '') is not null;

create or replace function public.sync_username_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_username text := nullif(btrim(new.raw_user_meta_data ->> 'username'), '');
begin
  if next_username is null then
    delete from public.username_claims where user_id = new.id;
  else
    insert into public.username_claims (user_id, username)
    values (new.id, next_username)
    on conflict (user_id) do update set username = excluded.username;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_username_claim() from public, anon, authenticated;

create trigger sync_username_claim_on_auth_user
after insert or update of raw_user_meta_data on auth.users
for each row execute function public.sync_username_claim();

create or replace function public.search_message_profiles(search_text text default '')
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, claim.username as display_name
  from public.profiles p
  join public.username_claims claim on claim.user_id = p.id
  where auth.uid() is not null
    and p.id <> auth.uid()
    and nullif(btrim(search_text), '') is not null
    and strpos(claim.username_key, lower(btrim(search_text))) > 0
  order by claim.username_key
  limit 30;
$$;

revoke all on function public.search_message_profiles(text) from public;
grant execute on function public.search_message_profiles(text) to authenticated;

create or replace function public.login_email_for_username(login_username text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.email::text
  from public.username_claims claim
  join auth.users u on u.id = claim.user_id
  where claim.username_key = lower(btrim(login_username));
$$;

revoke all on function public.login_email_for_username(text) from public, anon, authenticated;
grant execute on function public.login_email_for_username(text) to service_role;
