create table public.direct_message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index direct_message_reactions_user_id_idx
  on public.direct_message_reactions (user_id);

alter table public.direct_message_reactions enable row level security;

revoke all on table public.direct_message_reactions from public, anon, authenticated;
grant select, insert on table public.direct_message_reactions to authenticated;
grant update (is_active, updated_at) on table public.direct_message_reactions to authenticated;

create policy direct_message_reactions_select_conversation_member
on public.direct_message_reactions
for select
to authenticated
using (
  exists (
    select 1
    from public.messages message
    where message.id = direct_message_reactions.message_id
      and public.is_conversation_member(message.conversation_id)
  )
);

create policy direct_message_reactions_insert_own
on public.direct_message_reactions
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.messages message
    where message.id = direct_message_reactions.message_id
      and public.is_conversation_member(message.conversation_id)
  )
);

create policy direct_message_reactions_update_own
on public.direct_message_reactions
for update
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.messages message
    where message.id = direct_message_reactions.message_id
      and public.is_conversation_member(message.conversation_id)
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.messages message
    where message.id = direct_message_reactions.message_id
      and public.is_conversation_member(message.conversation_id)
  )
);

alter publication supabase_realtime add table public.direct_message_reactions;
