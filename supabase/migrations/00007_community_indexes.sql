-- M4: missing indexes on invites table + validate_invite_code RPC for unauthenticated invite checks

create index if not exists invites_created_by_idx on invites(created_by);
create index if not exists invites_active_idx on invites(expires_at) where used_by is null;

-- Security-definer function so unauthenticated users (pre-login) can check invite validity
-- without bypassing RLS on the invites table (which is moderator-only read).
create or replace function validate_invite_code(p_code text) returns boolean
language sql stable security definer as $$
  select exists(
    select 1 from invites
    where code = p_code
      and used_by is null
      and expires_at > now()
  )
$$;

grant execute on function validate_invite_code to anon;
