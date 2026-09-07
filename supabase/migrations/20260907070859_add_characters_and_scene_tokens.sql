-- Phase 7: campaign characters and their independent scene tokens.
create table public.characters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  image_url text not null check (image_url ~* '^https?://'),
  controlled_by uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index characters_campaign_id_idx on public.characters(campaign_id);
create index characters_controller_idx on public.characters(campaign_id, controlled_by) where controlled_by is not null;

create table public.scene_tokens (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.scenes(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  image_url text not null check (image_url ~* '^https?://'),
  controlled_by uuid references public.profiles(id) on delete set null,
  x double precision not null default 0 check (x not in ('NaN'::double precision, 'Infinity'::double precision, '-Infinity'::double precision)),
  y double precision not null default 0 check (y not in ('NaN'::double precision, 'Infinity'::double precision, '-Infinity'::double precision)),
  width double precision not null default 96 check (width between 24 and 10000),
  height double precision not null default 96 check (height between 24 and 10000),
  rotation double precision not null default 0 check (rotation not in ('NaN'::double precision, 'Infinity'::double precision, '-Infinity'::double precision)),
  z_index integer not null default 100,
  is_locked boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index scene_tokens_scene_z_index_idx on public.scene_tokens(scene_id, z_index, created_at);
create index scene_tokens_campaign_id_idx on public.scene_tokens(campaign_id);

alter table public.characters enable row level security;
alter table public.scene_tokens enable row level security;

create or replace function public.validate_scene_token()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  character_record public.characters%rowtype;
  scene_campaign_id uuid;
begin
  if tg_op = 'UPDATE' and new.created_by <> old.created_by then
    raise exception using errcode = '42501', message = 'token_creator_immutable';
  end if;

  select campaign_id into scene_campaign_id from public.scenes where id = new.scene_id;
  if scene_campaign_id is null or scene_campaign_id <> new.campaign_id then
    raise exception using errcode = '23503', message = 'token_scene_must_belong_to_campaign';
  end if;

  select * into character_record from public.characters where id = new.character_id;
  if not found or character_record.campaign_id <> new.campaign_id then
    raise exception using errcode = '23503', message = 'token_character_must_belong_to_campaign';
  end if;

  new.name := character_record.name;
  new.image_url := character_record.image_url;
  new.controlled_by := character_record.controlled_by;
  new.updated_at := now();
  return new;
end;
$$;

create trigger validate_scene_token_trigger
before insert or update of scene_id, campaign_id, character_id, name, image_url, controlled_by
on public.scene_tokens
for each row execute function public.validate_scene_token();

create or replace function public.enforce_player_scene_token_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_user_campaign_role(old.campaign_id) <> 'player' then
    return new;
  end if;
  if old.controlled_by is distinct from (select auth.uid()) or old.is_locked then
    raise exception using errcode = '42501', message = 'player_cannot_move_this_token';
  end if;
  if (to_jsonb(new) - 'x' - 'y' - 'updated_at')
     is distinct from (to_jsonb(old) - 'x' - 'y' - 'updated_at') then
    raise exception using errcode = '42501', message = 'player_can_only_move_own_token';
  end if;
  return new;
end;
$$;

create trigger enforce_player_scene_token_update_trigger
before update on public.scene_tokens
for each row execute function public.enforce_player_scene_token_update();

create policy "campaign members read characters" on public.characters for select to authenticated
using (public.current_user_campaign_role(campaign_id) is not null);
create policy "owners gms create characters" on public.characters for insert to authenticated
with check (public.current_user_campaign_role(campaign_id) in ('owner', 'gm') and created_by = (select auth.uid()));
create policy "owners gms update characters" on public.characters for update to authenticated
using (public.current_user_campaign_role(campaign_id) in ('owner', 'gm'))
with check (public.current_user_campaign_role(campaign_id) in ('owner', 'gm'));
create policy "owners gms delete characters" on public.characters for delete to authenticated
using (public.current_user_campaign_role(campaign_id) in ('owner', 'gm'));

create policy "campaign members read active scene tokens" on public.scene_tokens for select to authenticated
using (
  public.current_user_campaign_role(campaign_id) in ('owner', 'gm')
  or (public.current_user_campaign_role(campaign_id) = 'player' and exists (
    select 1 from public.scenes s where s.id = scene_id and s.campaign_id = campaign_id and s.is_active
  ))
);
create policy "owners gms create scene tokens" on public.scene_tokens for insert to authenticated
with check (public.current_user_campaign_role(campaign_id) in ('owner', 'gm') and created_by = (select auth.uid()));
create policy "owners gms update scene tokens" on public.scene_tokens for update to authenticated
using (public.current_user_campaign_role(campaign_id) in ('owner', 'gm'))
with check (public.current_user_campaign_role(campaign_id) in ('owner', 'gm'));
create policy "owners gms delete scene tokens" on public.scene_tokens for delete to authenticated
using (public.current_user_campaign_role(campaign_id) in ('owner', 'gm'));
create policy "players move own unlocked tokens" on public.scene_tokens for update to authenticated
using (public.current_user_campaign_role(campaign_id) = 'player' and controlled_by = (select auth.uid()) and not is_locked)
with check (public.current_user_campaign_role(campaign_id) = 'player' and controlled_by = (select auth.uid()));

grant select, insert, update, delete on public.characters, public.scene_tokens to authenticated;
revoke all on function public.validate_scene_token() from public, anon, authenticated;
revoke all on function public.enforce_player_scene_token_update() from public, anon, authenticated;
alter publication supabase_realtime add table public.scene_tokens;

create or replace function public.validate_character()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.created_by <> old.created_by then
    raise exception using errcode = '42501', message = 'character_creator_immutable';
  end if;
  if new.controlled_by is not null and not exists (
    select 1 from public.campaign_members m where m.campaign_id = new.campaign_id and m.user_id = new.controlled_by
  ) then
    raise exception using errcode = '23514', message = 'controller_must_be_campaign_member';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger validate_character_trigger before insert or update on public.characters
for each row execute function public.validate_character();

create or replace function public.sync_character_tokens()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.scene_tokens
  set name = new.name, image_url = new.image_url, controlled_by = new.controlled_by
  where character_id = new.id;
  return new;
end;
$$;

create trigger sync_character_tokens_trigger
after update of name, image_url, controlled_by on public.characters
for each row execute function public.sync_character_tokens();

revoke all on function public.validate_character() from public, anon, authenticated;
revoke all on function public.sync_character_tokens() from public, anon, authenticated;
