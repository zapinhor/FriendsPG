-- A biblioteca completa de assets fica disponível
-- somente para Owner e GM.

drop policy if exists "campaign members can read assets"
on public.assets;

create policy "owners and gms can read assets"
on public.assets
for select
to authenticated
using (
  public.current_user_campaign_role(campaign_id) in ('owner', 'gm')
);


-- Membros da campanha podem obter somente o background
-- de uma Scene que já conseguem visualizar via RLS.

create or replace function public.get_scene_background_url(
  target_scene_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  scene_campaign_id uuid;
  scene_is_active boolean;
  result_url text;
begin
  select
    s.campaign_id,
    s.is_active
  into
    scene_campaign_id,
    scene_is_active
  from public.scenes s
  where s.id = target_scene_id;

  if scene_campaign_id is null then
    raise exception
      using errcode = 'P0002',
      message = 'scene_not_found';
  end if;

  if public.current_user_campaign_role(scene_campaign_id) is null then
    raise exception
      using errcode = '42501',
      message = 'not_campaign_member';
  end if;

  -- Player só pode resolver o background da Scene ativa.
  if (
    public.current_user_campaign_role(scene_campaign_id) = 'player'
    and scene_is_active = false
  ) then
    raise exception
      using errcode = '42501',
      message = 'scene_not_available';
  end if;

  select
    coalesce(a.url, s.background_url)
  into result_url
  from public.scenes s
  left join public.assets a
    on a.id = s.background_asset_id
  where s.id = target_scene_id;

  return result_url;
end;
$$;

revoke all
on function public.get_scene_background_url(uuid)
from public, anon, authenticated;

grant execute
on function public.get_scene_background_url(uuid)
to authenticated;