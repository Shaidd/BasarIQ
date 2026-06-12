-- =============================================================
-- BasarIQ — Row Level Security policies
-- =============================================================

alter table public.profiles          enable row level security;
alter table public.cuts              enable row level security;
alter table public.cut_aliases       enable row level security;
alter table public.alias_suggestions enable row level security;
alter table public.vendors           enable row level security;
alter table public.photos            enable row level security;
alter table public.price_observations enable row level security;
alter table public.vendor_sources    enable row level security;
alter table public.ingestion_runs    enable row level security;
alter table public.shopping_lists    enable row level security;
alter table public.flags             enable row level security;
alter table public.invites           enable row level security;

-- =============================================================
-- Role helpers (called inside policies — security definer to
-- avoid infinite recursion on profiles SELECT policy)
-- =============================================================

create or replace function public.get_user_role()
returns text
language sql stable
security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_moderator()
returns boolean
language sql stable
security definer set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()) = 'moderator', false)
$$;

-- =============================================================
-- profiles
-- =============================================================
create policy "profiles: authenticated can read all"
  on public.profiles for select
  using (auth.uid() is not null);

create policy "profiles: user can insert own row"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles: user can update own row; moderator can update any"
  on public.profiles for update
  using (auth.uid() = id or is_moderator());

-- =============================================================
-- cuts
-- =============================================================
create policy "cuts: authenticated can read active"
  on public.cuts for select
  using (auth.uid() is not null and (status = 'active' or is_moderator()));

create policy "cuts: moderator only insert"
  on public.cuts for insert
  with check (is_moderator());

create policy "cuts: moderator only update"
  on public.cuts for update
  using (is_moderator());

create policy "cuts: moderator only delete"
  on public.cuts for delete
  using (is_moderator());

-- =============================================================
-- cut_aliases
-- =============================================================
create policy "cut_aliases: authenticated can read"
  on public.cut_aliases for select
  using (auth.uid() is not null);

create policy "cut_aliases: moderator only write"
  on public.cut_aliases for insert
  with check (is_moderator());

create policy "cut_aliases: moderator only update"
  on public.cut_aliases for update
  using (is_moderator());

create policy "cut_aliases: moderator only delete"
  on public.cut_aliases for delete
  using (is_moderator());

-- =============================================================
-- alias_suggestions
-- =============================================================
create policy "alias_suggestions: authenticated can read"
  on public.alias_suggestions for select
  using (auth.uid() is not null);

create policy "alias_suggestions: contributor can insert own"
  on public.alias_suggestions for insert
  with check (auth.uid() is not null and auth.uid() = suggested_by);

create policy "alias_suggestions: moderator can update (promote)"
  on public.alias_suggestions for update
  using (is_moderator());

-- =============================================================
-- vendors
-- =============================================================
create policy "vendors: authenticated can read active or own pending"
  on public.vendors for select
  using (
    auth.uid() is not null
    and (status = 'active' or is_moderator() or created_by = auth.uid())
  );

create policy "vendors: authenticated can insert (status forced to pending by trigger)"
  on public.vendors for insert
  with check (auth.uid() is not null);

create policy "vendors: moderator only update"
  on public.vendors for update
  using (is_moderator());

create policy "vendors: moderator only delete"
  on public.vendors for delete
  using (is_moderator());

-- =============================================================
-- photos
-- =============================================================
create policy "photos: authenticated can read"
  on public.photos for select
  using (auth.uid() is not null);

create policy "photos: contributor can insert own"
  on public.photos for insert
  with check (auth.uid() is not null and auth.uid() = uploaded_by);

-- =============================================================
-- price_observations
-- =============================================================
create policy "observations: authenticated can read active"
  on public.price_observations for select
  using (auth.uid() is not null and (status = 'active' or is_moderator()));

create policy "observations: contributor can insert own"
  on public.price_observations for insert
  with check (auth.uid() is not null and auth.uid() = contributor_id);

create policy "observations: contributor can update own within 24h; moderator anytime"
  on public.price_observations for update
  using (
    is_moderator()
    or (auth.uid() = contributor_id and created_at > now() - interval '24 hours')
  );

create policy "observations: moderator only delete"
  on public.price_observations for delete
  using (is_moderator());

-- =============================================================
-- vendor_sources
-- =============================================================
create policy "vendor_sources: authenticated can read"
  on public.vendor_sources for select
  using (auth.uid() is not null);

create policy "vendor_sources: moderator only insert"
  on public.vendor_sources for insert
  with check (is_moderator());

create policy "vendor_sources: moderator only update"
  on public.vendor_sources for update
  using (is_moderator());

create policy "vendor_sources: moderator only delete"
  on public.vendor_sources for delete
  using (is_moderator());

-- =============================================================
-- ingestion_runs
-- =============================================================
create policy "ingestion_runs: moderator only read"
  on public.ingestion_runs for select
  using (is_moderator());

-- service role writes ingestion_runs from edge functions (bypasses RLS)

-- =============================================================
-- shopping_lists
-- =============================================================
create policy "shopping_lists: owner only read"
  on public.shopping_lists for select
  using (auth.uid() = owner_id);

create policy "shopping_lists: owner only insert"
  on public.shopping_lists for insert
  with check (auth.uid() = owner_id);

create policy "shopping_lists: owner only update"
  on public.shopping_lists for update
  using (auth.uid() = owner_id);

create policy "shopping_lists: owner only delete"
  on public.shopping_lists for delete
  using (auth.uid() = owner_id);

-- =============================================================
-- flags
-- =============================================================
create policy "flags: moderator can read all; contributor can read own"
  on public.flags for select
  using (auth.uid() is not null and (is_moderator() or flagged_by = auth.uid()));

create policy "flags: authenticated can insert own"
  on public.flags for insert
  with check (auth.uid() is not null and auth.uid() = flagged_by);

create policy "flags: moderator only update (resolve)"
  on public.flags for update
  using (is_moderator());

-- =============================================================
-- invites
-- =============================================================
create policy "invites: moderator only read"
  on public.invites for select
  using (is_moderator());

create policy "invites: moderator only insert"
  on public.invites for insert
  with check (is_moderator());

-- allow marking invite as used (by the invitee during signup flow, via service role)
create policy "invites: moderator only update"
  on public.invites for update
  using (is_moderator());
