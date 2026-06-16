create table if not exists public.spot_comments (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references public.spots (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  username text not null,
  parent_id uuid references public.spot_comments (id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0 and char_length(content) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists spot_comments_spot_id_created_at_idx
on public.spot_comments (spot_id, created_at);

create index if not exists spot_comments_user_id_idx
on public.spot_comments (user_id);

create index if not exists spot_comments_parent_id_idx
on public.spot_comments (parent_id);

alter table public.spot_comments enable row level security;

grant select on public.spot_comments to anon, authenticated;
grant insert on public.spot_comments to authenticated;

drop policy if exists "spot_comments_select_all" on public.spot_comments;
create policy "spot_comments_select_all"
on public.spot_comments
for select
using (true);

drop policy if exists "spot_comments_insert_own" on public.spot_comments;
create policy "spot_comments_insert_own"
on public.spot_comments
for insert
to authenticated
with check (auth.uid() = user_id);
