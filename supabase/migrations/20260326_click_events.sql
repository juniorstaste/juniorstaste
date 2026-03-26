create table if not exists public.click_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users (id) on delete set null,
  spot_id uuid not null references public.spots (id) on delete cascade,
  button_type text not null,
  created_at timestamptz not null default now()
);

alter table public.click_events enable row level security;

drop policy if exists "click_events_insert_all" on public.click_events;
create policy "click_events_insert_all"
on public.click_events
for insert
to anon, authenticated
with check (true);

drop policy if exists "click_events_select_authenticated" on public.click_events;
create policy "click_events_select_authenticated"
on public.click_events
for select
to authenticated
using (true);
