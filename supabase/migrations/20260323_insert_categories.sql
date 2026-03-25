insert into public.categories (name, slug)
select 'Fried Chicken', 'fried-chicken'
where not exists (
  select 1 from public.categories where slug = 'fried-chicken'
);

insert into public.categories (name, slug)
select 'Frühstück / Kaffee', 'fruehstueck-kaffee'
where not exists (
  select 1 from public.categories where slug = 'fruehstueck-kaffee'
);

insert into public.categories (name, slug)
select 'Pizza', 'pizza'
where not exists (
  select 1 from public.categories where slug = 'pizza'
);

insert into public.categories (name, slug)
select 'Dessert', 'dessert'
where not exists (
  select 1 from public.categories where slug = 'dessert'
);

insert into public.categories (name, slug)
select 'Döner', 'doener'
where not exists (
  select 1 from public.categories where slug = 'doener'
);
