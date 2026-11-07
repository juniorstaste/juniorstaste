-- A username can exist before the app has created its optional profile row.
-- Use the unique username claim for discovery and conversation creation.
create or replace function public.search_message_profiles(search_text text default '')
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select claim.user_id, claim.username
  from public.username_claims claim
  where auth.uid() is not null
    and claim.user_id <> auth.uid()
    and nullif(btrim(search_text), '') is not null
    and strpos(claim.username_key, lower(btrim(search_text))) > 0
  order by claim.username_key
  limit 30;
$$;

revoke all on function public.search_message_profiles(text) from public, anon;
grant execute on function public.search_message_profiles(text) to authenticated;

create or replace function public.start_direct_conversation(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_id uuid;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null or other_user_id is null or other_user_id = current_user_id then
    raise exception 'Invalid conversation participant';
  end if;

  if not exists (select 1 from public.username_claims where user_id = other_user_id) then
    raise exception 'Username not found';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      least(current_user_id, other_user_id)::text || ':' || greatest(current_user_id, other_user_id)::text,
      0
    )
  );

  select cm.conversation_id into result_id
  from public.conversation_members cm
  where cm.user_id = current_user_id
    and exists (
      select 1 from public.conversation_members peer
      where peer.conversation_id = cm.conversation_id
        and peer.user_id = other_user_id
    )
    and (select count(*) from public.conversation_members all_members
         where all_members.conversation_id = cm.conversation_id) = 2
  limit 1;

  if result_id is not null then
    return result_id;
  end if;

  insert into public.conversations default values returning id into result_id;
  insert into public.conversation_members (conversation_id, user_id)
  values (result_id, current_user_id), (result_id, other_user_id);
  return result_id;
end;
$$;

revoke all on function public.start_direct_conversation(uuid) from public, anon;
grant execute on function public.start_direct_conversation(uuid) to authenticated;

create or replace function public.get_inbox()
returns table (
  conversation_id uuid,
  other_user_id uuid,
  other_display_name text,
  last_message_type public.message_type,
  last_message_body text,
  last_spot_name text,
  last_message_at timestamptz,
  unread_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    mine.conversation_id,
    peer.user_id,
    coalesce(claim.username, profile.display_name, 'Nutzer'),
    latest.type,
    latest.body,
    spot.name,
    latest.created_at,
    count(unread.id) filter (where unread.id is not null)
  from public.conversation_members mine
  join public.conversation_members peer
    on peer.conversation_id = mine.conversation_id and peer.user_id <> mine.user_id
  left join public.username_claims claim on claim.user_id = peer.user_id
  left join public.profiles profile on profile.id = peer.user_id
  left join lateral (
    select m.* from public.messages m
    where m.conversation_id = mine.conversation_id
    order by m.created_at desc limit 1
  ) latest on true
  left join public.spots spot on spot.id = latest.spot_id
  left join public.messages unread
    on unread.conversation_id = mine.conversation_id
    and unread.sender_id <> auth.uid()
    and unread.created_at > mine.last_read_at
  where mine.user_id = auth.uid()
  group by mine.conversation_id, peer.user_id, claim.username, profile.display_name,
    latest.type, latest.body, spot.name, latest.created_at
  order by latest.created_at desc nulls last;
$$;

revoke all on function public.get_inbox() from public, anon;
grant execute on function public.get_inbox() to authenticated;

create or replace function public.get_conversation_header(target_conversation_id uuid)
returns table (other_user_id uuid, other_display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select peer.user_id, coalesce(claim.username, profile.display_name, 'Nutzer')
  from public.conversation_members mine
  join public.conversation_members peer
    on peer.conversation_id = mine.conversation_id and peer.user_id <> mine.user_id
  left join public.username_claims claim on claim.user_id = peer.user_id
  left join public.profiles profile on profile.id = peer.user_id
  where mine.conversation_id = target_conversation_id
    and mine.user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_conversation_header(uuid) from public, anon;
grant execute on function public.get_conversation_header(uuid) to authenticated;
