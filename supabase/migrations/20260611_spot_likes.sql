create table if not exists public.spot_likes (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references public.spots (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, spot_id)
);

create index if not exists spot_likes_spot_id_idx on public.spot_likes (spot_id);
create index if not exists spot_likes_user_id_idx on public.spot_likes (user_id);

alter table public.spot_likes enable row level security;

drop policy if exists "spot_likes_select_all" on public.spot_likes;
create policy "spot_likes_select_all"
on public.spot_likes
for select
using (true);

drop policy if exists "spot_likes_insert_own" on public.spot_likes;
create policy "spot_likes_insert_own"
on public.spot_likes
for insert
with check (auth.uid() = user_id);

drop policy if exists "spot_likes_delete_own" on public.spot_likes;
create policy "spot_likes_delete_own"
on public.spot_likes
for delete
using (auth.uid() = user_id);
