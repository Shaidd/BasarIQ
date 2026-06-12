-- =============================================================
-- BasarIQ — core schema
-- =============================================================

-- User profiles extending Supabase auth.users
create table public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  display_name text not null,
  role        text not null default 'contributor'
                check (role in ('viewer', 'contributor', 'moderator')),
  home_region text
                check (home_region in ('north','haifa','sharon','center','jerusalem','shfela','south')),
  home_lat    double precision,
  home_lng    double precision,
  created_at  timestamptz not null default now()
);

-- Canonical cut catalog
create table public.cuts (
  id              uuid primary key default gen_random_uuid(),
  category        text not null default 'beef'
                    check (category in ('beef','lamb','fish')),
  name_en         text not null,
  name_he         text not null,
  israeli_number  int,
  primal          text
                    check (primal in ('chuck','rib','brisket','loin','round','plate','flank','shank','other')),
  kosher_notes    text,
  created_by      uuid references public.profiles(id),
  status          text not null default 'active'
                    check (status in ('active','merged','pending')),
  created_at      timestamptz not null default now()
);

-- Cut aliases — each alias maps to exactly one cut (case-insensitive uniqueness via index)
create table public.cut_aliases (
  id         uuid primary key default gen_random_uuid(),
  cut_id     uuid not null references public.cuts(id) on delete cascade,
  alias      text not null,
  lang       text not null check (lang in ('he','en','mixed')),
  created_at timestamptz not null default now()
);

-- Alias suggestions logged from OCR confirm screen; moderator can promote to cut_aliases
create table public.alias_suggestions (
  id               uuid primary key default gen_random_uuid(),
  cut_id           uuid not null references public.cuts(id) on delete cascade,
  suggested_alias  text not null,
  suggested_by     uuid not null references public.profiles(id),
  created_at       timestamptz not null default now(),
  promoted_at      timestamptz,
  promoted_by      uuid references public.profiles(id)
);

-- Vendor directory
create table public.vendors (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  type               text not null check (type in ('chain','butcher','online','market','farm')),
  region             text not null
                       check (region in ('north','haifa','sharon','center','jerusalem','shfela','south')),
  city               text not null,
  address            text,
  lat                double precision,
  lng                double precision,
  phone              text,
  website            text,
  delivers           boolean not null default false,
  delivery_regions   text[],          -- subset of region enum; ['*'] = nationwide
  delivery_fee       numeric,         -- flat ₪; null = unknown
  delivery_min_order numeric,
  rating             numeric check (rating >= 1 and rating <= 5),
  status             text not null default 'pending'
                       check (status in ('pending','active','closed','merged')),
  created_by         uuid references public.profiles(id),
  created_at         timestamptz not null default now()
);

-- Photos for OCR audit trail
create table public.photos (
  id              uuid primary key default gen_random_uuid(),
  storage_path    text not null,
  vendor_id       uuid not null references public.vendors(id),
  uploaded_by     uuid not null references public.profiles(id),
  extraction_json jsonb,             -- raw ExtractionRow[] from Claude
  created_at      timestamptz not null default now()
);

-- Price observations (all three sources)
create table public.price_observations (
  id              uuid primary key default gen_random_uuid(),
  vendor_id       uuid not null references public.vendors(id),
  cut_id          uuid not null references public.cuts(id),
  price_per_kg    numeric not null check (price_per_kg > 0),
  currency        text not null default 'ILS',
  is_sale         boolean not null default false,
  sale_ends_at    date,
  source          text not null check (source in ('manual','photo','web_auto')),
  confidence      numeric check (confidence >= 0 and confidence <= 1),
  photo_id        uuid references public.photos(id),
  source_url      text,
  contributor_id  uuid references public.profiles(id),
  observed_at     timestamptz not null,
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  status          text not null default 'active'
                    check (status in ('active','hidden','removed')),
  raw_text        text,
  -- manual/photo observations must have a contributor
  constraint contributor_required_for_non_auto
    check (source = 'web_auto' or contributor_id is not null)
);

-- Vendor sources for nightly web extraction (M5)
create table public.vendor_sources (
  id               uuid primary key default gen_random_uuid(),
  vendor_id        uuid not null references public.vendors(id),
  url              text not null,
  kind             text not null check (kind in ('price_page','weekly_ad','social')),
  crawl_frequency  text not null default 'daily',
  status           text not null default 'active'
                     check (status in ('active','broken','paused')),
  last_run_at      timestamptz,
  fail_count       int not null default 0,
  created_at       timestamptz not null default now()
);

-- Ingestion run log
create table public.ingestion_runs (
  id                   uuid primary key default gen_random_uuid(),
  source_id            uuid not null references public.vendor_sources(id),
  started_at           timestamptz not null,
  finished_at          timestamptz,
  result               text check (result in ('ok','parse_error','fetch_error')),
  observations_written int not null default 0,
  queued_for_review    int not null default 0,
  log                  jsonb
);

-- Shopping lists
create table public.shopping_lists (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id),
  name       text not null,
  items      jsonb not null default '[]'::jsonb,  -- [{cut_id: uuid, kg: number}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Observation flags
create table public.flags (
  id             uuid primary key default gen_random_uuid(),
  observation_id uuid not null references public.price_observations(id),
  flagged_by     uuid not null references public.profiles(id),
  reason         text not null,
  created_at     timestamptz not null default now(),
  resolved_by    uuid references public.profiles(id),
  resolved_at    timestamptz,
  resolution     text
);

-- Invite codes (moderator-generated, single-use, 7-day expiry)
create table public.invites (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  created_by uuid not null references public.profiles(id),
  used_by    uuid references public.profiles(id),
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

-- =============================================================
-- Triggers
-- =============================================================

-- Auto-create profile row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email, 'User'),
    'contributor'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Force status=pending for vendor inserts by non-moderators
create or replace function public.enforce_vendor_pending()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  caller_role text;
begin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role is distinct from 'moderator' then
    new.status := 'pending';
  end if;
  return new;
end;
$$;

create trigger vendor_force_pending_on_insert
  before insert on public.vendors
  for each row execute procedure public.enforce_vendor_pending();
