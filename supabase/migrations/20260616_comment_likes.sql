create table if not exists public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.spot_comments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint comment_likes_comment_id_user_id_key unique (comment_id, user_id)
);

create index if not exists comment_likes_comment_id_idx
on public.comment_likes (comment_id);

create index if not exists comment_likes_user_id_idx
on public.comment_likes (user_id);

alter table public.comment_likes enable row level security;

grant select on public.comment_likes to anon, authenticated;
grant insert, delete on public.comment_likes to authenticated;

drop policy if exists "comment_likes_select_all" on public.comment_likes;
create policy "comment_likes_select_all"
on public.comment_likes
for select
using (true);

drop policy if exists "comment_likes_insert_own" on public.comment_likes;
create policy "comment_likes_insert_own"
on public.comment_likes
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "comment_likes_delete_own" on public.comment_likes;
create policy "comment_likes_delete_own"
on public.comment_likes
for delete
to authenticated
using (auth.uid() = user_id);
