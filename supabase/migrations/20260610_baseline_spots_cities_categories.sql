-- Baseline für die Content-Tabellen (spots, cities, categories).
--
-- HINTERGRUND: Diese Tabellen wurden ursprünglich über das Supabase-Dashboard
-- angelegt und waren nie in den Migrationen versioniert. Diese Datei wurde am
-- 2026-06-10 aus dem Live-Schema rekonstruiert (Spaltenlisten via REST-API
-- verifiziert; exakte Typen/Constraints teilweise inferiert — siehe TODOs).
-- Durch IF NOT EXISTS ist sie gegen die Live-DB idempotent.
--
-- TODO (sobald Owner-Zugriff via supabase CLI/pg_dump besteht):
--   * Typen gegen `supabase db dump` abgleichen (insb. rating/price_level/lat/lng)
--   * Tatsächliche RLS-Policies der Live-DB übernehmen
--   * Indexe/Unique-Constraints der Live-DB übernehmen

create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.spots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  address text,
  lat double precision,
  lng double precision,
  image_url text,
  tiktok_embed_id text,
  rating numeric,
  price_level smallint,
  google_maps_link text,
  city_id uuid references public.cities (id),
  category_id uuid references public.categories (id),
  created_at timestamptz not null default now(),
  wolt_url text,
  lieferando_url text,
  uber_eats_url text
);

-- Öffentlicher Lesezugriff (App nutzt den Anon-Key clientseitig);
-- Schreibzugriff bleibt vorerst gesperrt — Admin-Policies folgen in Step 3.
alter table public.cities enable row level security;
alter table public.categories enable row level security;
alter table public.spots enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cities' and policyname = 'Cities are publicly readable'
  ) then
    create policy "Cities are publicly readable"
      on public.cities for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'categories' and policyname = 'Categories are publicly readable'
  ) then
    create policy "Categories are publicly readable"
      on public.categories for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'spots' and policyname = 'Spots are publicly readable'
  ) then
    create policy "Spots are publicly readable"
      on public.spots for select
      to anon, authenticated
      using (true);
  end if;
end $$;
