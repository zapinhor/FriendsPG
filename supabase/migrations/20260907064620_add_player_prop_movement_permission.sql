-- Phase 6: campaign-configurable, least-privilege player table access.
-- Players may optionally move unlocked props, but cannot create, delete, resize,
-- rotate, lock, reorder, or otherwise alter them.

create or replace function public.player_prop_movement_enabled(target_campaign_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(settings ->> 'allow_player_prop_movement', 'false') = 'true'
  from public.campaigns
  where id = target_campaign_id;
$$;

revoke all on function public.player_prop_movement_enabled(uuid) from public, anon, authenticated;
grant execute on function public.player_prop_movement_enabled(uuid) to authenticated;

create or replace function public.set_campaign_table_permissions(
  target_campaign_id uuid,
  allow_player_prop_movement boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.campaigns
  set settings = settings || jsonb_build_object(
    'allow_player_prop_movement', allow_player_prop_movement
  )
  where id = target_campaign_id
    and owner_id = (select auth.uid());

  if not found then
    raise exception using
      errcode = '42501',
      message = 'owner_required';
  end if;
end;
$$;

revoke all on function public.set_campaign_table_permissions(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_campaign_table_permissions(uuid, boolean) to authenticated;

create or replace function public.enforce_campaign_settings_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.settings is distinct from old.settings
     and old.owner_id <> (select auth.uid()) then
    raise exception using errcode = '42501', message = 'owner_required_to_change_campaign_settings';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_campaign_settings_owner() from public, anon, authenticated;

create trigger enforce_campaign_settings_owner_trigger
before update of settings on public.campaigns
for each row execute function public.enforce_campaign_settings_owner();

create or replace function public.enforce_player_scene_prop_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_user_campaign_role(old.campaign_id) <> 'player' then
    return new;
  end if;

  if not public.player_prop_movement_enabled(old.campaign_id) then
    raise exception using errcode = '42501', message = 'player_prop_movement_not_allowed';
  end if;

  if old.is_locked then
    raise exception using errcode = '42501', message = 'prop_is_locked';
  end if;

  if (to_jsonb(new) - 'x' - 'y' - 'updated_at')
     is distinct from (to_jsonb(old) - 'x' - 'y' - 'updated_at') then
    raise exception using errcode = '42501', message = 'player_can_only_move_props';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_player_scene_prop_update() from public, anon, authenticated;

create trigger enforce_player_scene_prop_update_trigger
before update on public.scene_props
for each row execute function public.enforce_player_scene_prop_update();

create policy "permitted players move unlocked props"
on public.scene_props
for update
to authenticated
using (
  public.current_user_campaign_role(campaign_id) = 'player'
  and public.player_prop_movement_enabled(campaign_id)
  and not is_locked
)
with check (
  public.current_user_campaign_role(campaign_id) = 'player'
  and public.player_prop_movement_enabled(campaign_id)
);
