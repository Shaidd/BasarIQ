-- =============================================================
-- BasarIQ — performance indexes
-- =============================================================

-- Alias resolution: exact (case-insensitive) + trigram fuzzy
create unique index cut_aliases_alias_lower_uniq on public.cut_aliases (lower(alias));
create index cut_aliases_alias_trgm_idx on public.cut_aliases using gin (alias gin_trgm_ops);

-- Alias suggestions dedup
create unique index alias_suggestions_uniq on public.alias_suggestions (cut_id, lower(suggested_alias));

-- Price observations: sourcing engine core query
create index price_obs_vendor_cut_status_idx on public.price_observations (vendor_id, cut_id, status);
create index price_obs_cut_observed_idx      on public.price_observations (cut_id, observed_at desc);
create index price_obs_vendor_observed_idx   on public.price_observations (vendor_id, observed_at desc);
create index price_obs_contributor_idx       on public.price_observations (contributor_id);
-- regional median calculation
create index price_obs_cut_status_idx        on public.price_observations (cut_id, status);

-- Vendors: geo radius + delivery candidate lookup
create index vendors_region_status_idx on public.vendors (region, status);
create index vendors_delivers_idx      on public.vendors (delivers, status) where delivers = true;
-- Lat/lng index for earthdistance queries (non-null only)
create index vendors_latlon_idx on public.vendors (lat, lng)
  where lat is not null and lng is not null;

-- Cuts: category + status lookup
create index cuts_category_status_idx on public.cuts (category, status);

-- Flags: moderator queue (unresolved only)
create index flags_observation_idx    on public.flags (observation_id);
create index flags_unresolved_idx     on public.flags (resolved_by) where resolved_by is null;

-- Ingestion monitoring
create index ingestion_runs_source_idx    on public.ingestion_runs (source_id, started_at desc);
create index vendor_sources_status_idx    on public.vendor_sources (status, last_run_at);
