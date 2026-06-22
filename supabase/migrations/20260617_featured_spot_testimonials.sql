alter table public.spot_comments
add column if not exists featured_on_spot_page boolean not null default false,
add column if not exists featured_order integer;

create index if not exists spot_comments_featured_spot_idx
on public.spot_comments (spot_id, featured_on_spot_page, featured_order, created_at);
