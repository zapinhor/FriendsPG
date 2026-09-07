-- Replace an external asset URL without losing the props already placed on scenes.
-- The function updates the asset and its URL snapshots atomically.
create or replace function public.replace_asset_external_url(
  target_campaign_id uuid,
  target_asset_id uuid,
  replacement_url text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  asset_campaign_id uuid;
  normalized_url text := trim(replacement_url);
  affected_props integer;
begin
  if normalized_url !~* '^https?://' or normalized_url ~ '\s' then
    raise exception using errcode = '22023', message = 'invalid_external_url';
  end if;

  select campaign_id
  into asset_campaign_id
  from public.assets
  where id = target_asset_id
  for update;

  if not found or asset_campaign_id <> target_campaign_id then
    raise exception using errcode = '23503', message = 'asset_not_found_in_campaign';
  end if;

  if public.current_user_campaign_role(target_campaign_id) not in ('owner', 'gm') then
    raise exception using errcode = '42501', message = 'insufficient_campaign_role';
  end if;

  update public.assets
  set url = normalized_url
  where id = target_asset_id;

  update public.scene_props
  set image_url = normalized_url
  where asset_id = target_asset_id
    and campaign_id = target_campaign_id;

  get diagnostics affected_props = row_count;
  return affected_props;
end;
$$;

revoke all on function public.replace_asset_external_url(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.replace_asset_external_url(uuid, uuid, text) to authenticated;
