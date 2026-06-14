-- M5: Performance indexes for web extraction queries
create index if not exists vendor_sources_status_idx
  on vendor_sources (status, last_run_at);
create index if not exists ingestion_runs_source_idx
  on ingestion_runs (source_id, started_at desc);
create index if not exists price_obs_web_auto_review_idx
  on price_observations (source, status)
  where source = 'web_auto' and status = 'hidden';

-- Enable pg_cron and pg_net for scheduled edge function invocation.
-- Both extensions may already be enabled in your Supabase project.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Nightly extraction at midnight UTC (2am IST / 3am IDST in summer).
-- Requires app.supabase_url and app.service_role_key to be set in
-- Supabase → Database → Settings → Custom config, or replace the
-- current_setting() calls with literal strings.
select cron.schedule(
  'nightly-price-extraction',
  '0 0 * * *',
  $$
    select net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/extract-prices',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body    := '{}'::jsonb
    )
  $$
);
