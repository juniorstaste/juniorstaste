create or replace view public.spots_with_city as
select
  s.*,
  c.name as city_name,
  c.slug as city_slug,
  cat.name as category_name,
  cat.slug as category_slug
from public.spots s
left join public.cities c on c.id = s.city_id
left join public.categories cat on cat.id = s.category_id;
