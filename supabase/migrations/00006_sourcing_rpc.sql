-- M3: Sourcing engine — vendor radius query
-- Uses earthdistance extension (enabled in 00001_enable_extensions.sql)

create function get_vendors_in_radius(
  user_lat double precision,
  user_lng double precision,
  radius_km double precision
) returns setof vendors
language sql stable security definer as $$
  select * from vendors
  where status = 'active'
    and lat is not null
    and lng is not null
    and earth_distance(ll_to_earth(lat, lng), ll_to_earth(user_lat, user_lng)) <= radius_km * 1000
$$;

-- Allow authenticated users to call this RPC via the Supabase JS client
grant execute on function get_vendors_in_radius to authenticated;
