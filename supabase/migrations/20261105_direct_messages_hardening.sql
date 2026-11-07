-- Keep a spot message in chat history when its spot is deleted. New spot
-- messages still require a real spot through the INSERT policy below.
alter table public.messages drop constraint messages_payload_check;
alter table public.messages add constraint messages_payload_check check (
  (type = 'text' and nullif(btrim(body), '') is not null and char_length(body) <= 2000 and spot_id is null)
  or (type = 'spot' and body is null)
);

drop policy messages_insert_member on public.messages;
create policy messages_insert_member on public.messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and public.is_conversation_member(conversation_id)
  and (type <> 'spot' or spot_id is not null)
);

-- Serialize the first conversation creation for either order of the user pair.
-- All conversation inserts go through this RPC; clients have no INSERT grant.
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

  if not exists (select 1 from public.profiles where id = other_user_id) then
    raise exception 'Profile not found';
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

-- Read timestamps update unread badges in other open sessions.
alter publication supabase_realtime add table public.conversation_members;
