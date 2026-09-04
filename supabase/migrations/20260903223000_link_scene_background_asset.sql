alter table public.scenes
add column background_asset_id uuid
references public.assets(id)
on delete set null;

create index scenes_background_asset_id_idx
on public.scenes(background_asset_id);

create or replace function public.validate_scene_background_asset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.background_asset_id is not null then
    if not exists (
      select 1
      from public.assets
      where assets.id = new.background_asset_id
        and assets.campaign_id = new.campaign_id
    ) then
      raise exception
        using errcode = '23514',
        message = 'background_asset_must_belong_to_campaign';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_scene_background_asset_trigger
on public.scenes;

create trigger validate_scene_background_asset_trigger
before insert or update of background_asset_id, campaign_id
on public.scenes
for each row
execute function public.validate_scene_background_asset();