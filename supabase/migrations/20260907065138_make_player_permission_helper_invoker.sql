-- The helper is only a campaign-settings read. Running it as the caller keeps
-- its campaign RLS checks in force and avoids exposing a definer RPC endpoint.
create or replace function public.player_prop_movement_enabled(target_campaign_id uuid)
returns boolean
language sql
security invoker
stable
set search_path = ''
as $$
  select coalesce(settings ->> 'allow_player_prop_movement', 'false') = 'true'
  from public.campaigns
  where id = target_campaign_id;
$$;

revoke all on function public.player_prop_movement_enabled(uuid) from public, anon;
grant execute on function public.player_prop_movement_enabled(uuid) to authenticated;
