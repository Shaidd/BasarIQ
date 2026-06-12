-- =============================================================
-- BasarIQ — shared SQL functions
-- =============================================================

-- Strip Hebrew nikud (U+05B0–U+05C7) and non-alpha punctuation,
-- lowercase, trim — used by alias resolution and trigram search
create or replace function public.normalize_alias_input(raw text)
returns text
language sql
immutable
as $$
  select trim(lower(
    regexp_replace(
      regexp_replace(raw, '[ְ-ׇװ-״]', '', 'g'),
      '[^א-ת׳״a-zA-Z0-9 ]',
      ' ',
      'g'
    )
  ))
$$;

-- Resolve a raw alias string to up to 3 matching cuts.
-- Pipeline: exact → trigram ≥ 0.75 → empty.
-- Called by Edge Functions; not exposed to anon clients.
create or replace function public.resolve_cut_alias(raw text)
returns table (cut_id uuid, match_type text, sim float4)
language sql
stable
security definer set search_path = public
as $$
  with n as (select normalize_alias_input(raw) as v)
  select
    a.cut_id,
    case when lower(a.alias) = (select v from n) then 'exact' else 'fuzzy' end as match_type,
    similarity(a.alias, (select v from n)) as sim
  from public.cut_aliases a
  where
    lower(a.alias) = (select v from n)
    or similarity(a.alias, (select v from n)) >= 0.75
  order by
    (lower(a.alias) = (select v from n)) desc,
    sim desc
  limit 3
$$;

-- 90-day regional median price for a cut — used for outlier guard and
-- missing-cut penalty in sourcing engine.
-- Returns null if fewer than 3 data points (too sparse to be meaningful).
create or replace function public.cut_regional_median(
  p_cut_id uuid,
  p_region  text,
  p_days    int default 90
)
returns numeric
language sql
stable
security definer set search_path = public
as $$
  select
    case when count(*) >= 3
      then percentile_cont(0.5) within group (order by o.price_per_kg)
      else null
    end
  from public.price_observations o
  join public.vendors v on v.id = o.vendor_id
  where o.cut_id   = p_cut_id
    and v.region   = p_region
    and o.status   = 'active'
    and o.observed_at >= now() - (p_days || ' days')::interval
$$;

-- Freshness helper: returns 'fresh' | 'stale' | 'expired' for an observation.
-- Mirrors the UI badge logic so the sourcing engine can filter consistently.
create or replace function public.observation_freshness(
  p_source       text,
  p_observed_at  timestamptz,
  p_is_sale      boolean default false,
  p_sale_ends_at date default null
)
returns text
language sql
immutable
as $$
  select case
    when p_is_sale and p_sale_ends_at is not null and p_sale_ends_at < current_date
      then 'expired'
    when p_source = 'web_auto' and p_observed_at < now() - interval '7 days'
      then 'expired'
    when p_source in ('manual','photo') and p_observed_at < now() - interval '21 days'
      then 'expired'
    when p_observed_at < now() - interval '7 days'
      then 'stale'
    else 'fresh'
  end
$$;
