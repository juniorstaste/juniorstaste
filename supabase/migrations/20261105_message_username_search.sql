-- Apply after 20261105_direct_messages.sql. Only the signup username is searchable.
create or replace function public.search_message_profiles(search_text text default '')
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, btrim(u.raw_user_meta_data ->> 'username') as display_name
  from public.profiles p
  join auth.users u on u.id = p.id
  where auth.uid() is not null
    and p.id <> auth.uid()
    and nullif(btrim(u.raw_user_meta_data ->> 'username'), '') is not null
    and nullif(btrim(search_text), '') is not null
    and strpos(
      lower(btrim(u.raw_user_meta_data ->> 'username')),
      lower(btrim(search_text))
    ) > 0
  order by btrim(u.raw_user_meta_data ->> 'username')
  limit 30;
$$;

revoke all on function public.search_message_profiles(text) from public;
grant execute on function public.search_message_profiles(text) to authenticated;
