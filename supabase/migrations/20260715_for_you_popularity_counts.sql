-- Expose aggregate engagement only; underlying user rows remain protected by RLS.
create or replace function public.get_for_you_spot_popularity()
returns table (
  spot_id uuid,
  like_count bigint,
  save_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with like_counts as (
    select spot_id, count(*) as like_count
    from public.spot_likes
    group by spot_id
  ),
  save_counts as (
    select spot_id, count(*) as save_count
    from public.saved_spots
    group by spot_id
  )
  select
    spots.id as spot_id,
    coalesce(like_counts.like_count, 0)::bigint as like_count,
    coalesce(save_counts.save_count, 0)::bigint as save_count
  from public.spots as spots
  left join like_counts on like_counts.spot_id = spots.id
  left join save_counts on save_counts.spot_id = spots.id
  where spots.video_url is not null;
$$;

revoke all on function public.get_for_you_spot_popularity() from public;
grant execute on function public.get_for_you_spot_popularity() to anon, authenticated;

comment on function public.get_for_you_spot_popularity() is
  'Returns non-identifying aggregate like and save counts for For You ranking.';
