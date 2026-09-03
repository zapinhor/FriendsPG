create unique index scenes_one_active_per_campaign_idx
on public.scenes(campaign_id)
where is_active = true;

create function public.set_active_scene(
  target_campaign_id uuid,
  target_scene_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_user_campaign_role(target_campaign_id) not in ('owner', 'gm') then
    raise exception using
      errcode = '42501',
      message = 'insufficient_campaign_role';
  end if;

  if not exists (
    select 1
    from public.scenes
    where id = target_scene_id
      and campaign_id = target_campaign_id
  ) then
    raise exception using
      errcode = 'P0002',
      message = 'scene_not_found';
  end if;

  update public.scenes
  set
    is_active = false,
    updated_at = now()
  where campaign_id = target_campaign_id
    and is_active = true;

  update public.scenes
  set
    is_active = true,
    updated_at = now()
  where id = target_scene_id
    and campaign_id = target_campaign_id;
end;
$$;

revoke all on function public.set_active_scene(uuid, uuid)
from public, anon, authenticated;

grant execute on function public.set_active_scene(uuid, uuid)
to authenticated;