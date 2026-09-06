-- Phase 4: interactive props rendered over scenes.
create table public.scene_props (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.scenes(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 120),
  image_url text not null check (image_url ~* '^https?://'),
  x double precision not null default 0 check (x not in ('NaN'::double precision, 'Infinity'::double precision, '-Infinity'::double precision)),
  y double precision not null default 0 check (y not in ('NaN'::double precision, 'Infinity'::double precision, '-Infinity'::double precision)),
  width double precision not null default 160 check (width > 0 and width <= 10000),
  height double precision not null default 160 check (height > 0 and height <= 10000),
  rotation double precision not null default 0 check (rotation not in ('NaN'::double precision, 'Infinity'::double precision, '-Infinity'::double precision)),
  flip_horizontal boolean not null default false,
  flip_vertical boolean not null default false,
  z_index integer not null default 0,
  is_locked boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index scene_props_scene_z_index_idx
on public.scene_props(scene_id, z_index, created_at);

create index scene_props_campaign_id_idx
on public.scene_props(campaign_id);

alter table public.scene_props enable row level security;

-- Keep the denormalized campaign and URL trustworthy. The URL snapshot lets
-- players render a prop without gaining SELECT access to the asset library.
create or replace function public.validate_scene_prop()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  scene_campaign_id uuid;
  source_asset public.assets%rowtype;
begin
  if tg_op = 'UPDATE' and new.created_by <> old.created_by then
    raise exception using errcode = '42501', message = 'prop_creator_cannot_change';
  end if;

  select s.campaign_id
    into scene_campaign_id
  from public.scenes s
  where s.id = new.scene_id;

  if scene_campaign_id is null then
    raise exception using errcode = '23503', message = 'scene_not_found';
  end if;

  new.campaign_id := scene_campaign_id;

  select * into source_asset
  from public.assets a
  where a.id = new.asset_id;

  if source_asset.id is null or source_asset.campaign_id <> scene_campaign_id then
    raise exception using errcode = '23514', message = 'prop_asset_must_belong_to_campaign';
  end if;

  if source_asset.url is null then
    raise exception using errcode = '23514', message = 'prop_asset_requires_external_url';
  end if;

  new.image_url := source_asset.url;

  new.updated_at := now();
  return new;
end;
$$;

create trigger validate_scene_prop_trigger
before insert or update of scene_id, campaign_id, asset_id, image_url
on public.scene_props
for each row execute function public.validate_scene_prop();

create policy "campaign members can read visible scene props"
on public.scene_props
for select
to authenticated
using (
  public.current_user_campaign_role(campaign_id) in ('owner', 'gm')
  or (
    public.current_user_campaign_role(campaign_id) = 'player'
    and exists (
      select 1 from public.scenes s
      where s.id = scene_id
        and s.campaign_id = campaign_id
        and s.is_active = true
    )
  )
);

create policy "owners and gms can create props"
on public.scene_props
for insert
to authenticated
with check (
  public.current_user_campaign_role(campaign_id) in ('owner', 'gm')
  and created_by = (select auth.uid())
);

create policy "owners and gms can update props"
on public.scene_props
for update
to authenticated
using (public.current_user_campaign_role(campaign_id) in ('owner', 'gm'))
with check (public.current_user_campaign_role(campaign_id) in ('owner', 'gm'));

create policy "owners and gms can delete props"
on public.scene_props
for delete
to authenticated
using (public.current_user_campaign_role(campaign_id) in ('owner', 'gm'));

grant select, insert, update, delete on public.scene_props to authenticated;

revoke all on function public.validate_scene_prop() from public, anon, authenticated;

alter publication supabase_realtime add table public.scene_props;
