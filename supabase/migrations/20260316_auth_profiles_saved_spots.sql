create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_spots (
  user_id uuid not null references auth.users (id) on delete cascade,
  spot_id uuid not null references public.spots (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, spot_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.saved_spots enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "saved_spots_select_own" on public.saved_spots;
create policy "saved_spots_select_own"
on public.saved_spots
for select
using (auth.uid() = user_id);

drop policy if exists "saved_spots_insert_own" on public.saved_spots;
create policy "saved_spots_insert_own"
on public.saved_spots
for insert
with check (auth.uid() = user_id);

drop policy if exists "saved_spots_update_own" on public.saved_spots;
create policy "saved_spots_update_own"
on public.saved_spots
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "saved_spots_delete_own" on public.saved_spots;
create policy "saved_spots_delete_own"
on public.saved_spots
for delete
using (auth.uid() = user_id);
