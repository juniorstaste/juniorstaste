-- Security Advisor fix: keep click_events append-only for client analytics.
alter table public.click_events enable row level security;

revoke select, update, delete on table public.click_events from anon, authenticated;
grant insert on table public.click_events to anon, authenticated;

drop policy if exists "click_events_insert_all" on public.click_events;
drop policy if exists "click_events_select_authenticated" on public.click_events;
drop policy if exists "click_events_insert_anon" on public.click_events;
drop policy if exists "click_events_insert_authenticated" on public.click_events;

create policy "click_events_insert_anon"
on public.click_events
for insert
to anon
with check (user_id is null);

create policy "click_events_insert_authenticated"
on public.click_events
for insert
to authenticated
with check (user_id is null or user_id = auth.uid());

-- Security Advisor fix: make the public read view respect the caller's privileges/RLS.
alter view public.spots_with_city set (security_invoker = true);
grant select on public.spots_with_city to anon, authenticated;
