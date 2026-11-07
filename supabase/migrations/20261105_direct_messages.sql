create type public.message_type as enum ('text', 'spot');

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  type public.message_type not null,
  body text,
  spot_id uuid references public.spots (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint messages_payload_check check (
    (type = 'text' and nullif(btrim(body), '') is not null and char_length(body) <= 2000 and spot_id is null)
    or
    (type = 'spot' and spot_id is not null and body is null)
  )
);

create index conversation_members_user_id_idx
  on public.conversation_members (user_id, conversation_id);
create index messages_conversation_created_at_idx
  on public.messages (conversation_id, created_at desc);
create index messages_sender_id_idx on public.messages (sender_id);

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

create or replace function public.is_conversation_member(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members
    where conversation_id = target_conversation_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_conversation_member(uuid) from public;
grant execute on function public.is_conversation_member(uuid) to authenticated;

create policy conversations_select_member on public.conversations
for select to authenticated
using (public.is_conversation_member(id));

create policy conversation_members_select_member on public.conversation_members
for select to authenticated
using (public.is_conversation_member(conversation_id));

create policy conversation_members_update_own on public.conversation_members
for update to authenticated
using (user_id = auth.uid() and public.is_conversation_member(conversation_id))
with check (user_id = auth.uid() and public.is_conversation_member(conversation_id));

create policy messages_select_member on public.messages
for select to authenticated
using (public.is_conversation_member(conversation_id));

create policy messages_insert_member on public.messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and public.is_conversation_member(conversation_id)
);

create or replace function public.start_direct_conversation(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  result_id uuid;
begin
  if auth.uid() is null or other_user_id is null or other_user_id = auth.uid() then
    raise exception 'Invalid conversation participant';
  end if;

  if not exists (select 1 from public.profiles where id = other_user_id) then
    raise exception 'Profile not found';
  end if;

  select cm.conversation_id into result_id
  from public.conversation_members cm
  where cm.user_id = auth.uid()
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
  values (result_id, auth.uid()), (result_id, other_user_id);
  return result_id;
end;
$$;

revoke all on function public.start_direct_conversation(uuid) from public;
grant execute on function public.start_direct_conversation(uuid) to authenticated;

create or replace function public.search_message_profiles(search_text text default '')
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name
  from public.profiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and (nullif(btrim(search_text), '') is null or p.display_name ilike '%' || btrim(search_text) || '%')
  order by p.display_name
  limit 30;
$$;

revoke all on function public.search_message_profiles(text) from public;
grant execute on function public.search_message_profiles(text) to authenticated;

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
set search_path = public
as $$
  select
    mine.conversation_id,
    peer.user_id,
    profile.display_name,
    latest.type,
    latest.body,
    spot.name,
    latest.created_at,
    count(unread.id) filter (where unread.id is not null)
  from public.conversation_members mine
  join public.conversation_members peer
    on peer.conversation_id = mine.conversation_id and peer.user_id <> mine.user_id
  join public.profiles profile on profile.id = peer.user_id
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
  group by mine.conversation_id, peer.user_id, profile.display_name,
    latest.type, latest.body, spot.name, latest.created_at
  order by latest.created_at desc nulls last;
$$;

revoke all on function public.get_inbox() from public;
grant execute on function public.get_inbox() to authenticated;

create or replace function public.get_conversation_header(target_conversation_id uuid)
returns table (other_user_id uuid, other_display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select peer.user_id, profile.display_name
  from public.conversation_members mine
  join public.conversation_members peer
    on peer.conversation_id = mine.conversation_id and peer.user_id <> mine.user_id
  join public.profiles profile on profile.id = peer.user_id
  where mine.conversation_id = target_conversation_id
    and mine.user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_conversation_header(uuid) from public;
grant execute on function public.get_conversation_header(uuid) to authenticated;

create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations set updated_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_touch_conversation
after insert on public.messages
for each row execute function public.touch_conversation();

grant select on public.conversations, public.conversation_members, public.messages to authenticated;
grant insert on public.messages to authenticated;
grant update (last_read_at) on public.conversation_members to authenticated;

alter publication supabase_realtime add table public.messages;
