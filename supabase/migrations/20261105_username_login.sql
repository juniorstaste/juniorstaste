-- Used only by the server-side login endpoint. Never grant this lookup to anon.
create or replace function public.login_email_for_username(login_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when count(*) = 1 then min(email::text) else null end
  from auth.users
  where lower(btrim(raw_user_meta_data ->> 'username')) = lower(btrim(login_username));
$$;

revoke all on function public.login_email_for_username(text) from public, anon, authenticated;
grant execute on function public.login_email_for_username(text) to service_role;
