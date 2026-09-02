-- Mesa Viva — baseline segura da Fase 1. Execute uma vez em um projeto novo.
create extension if not exists "pgcrypto";
create type public.campaign_role as enum ('owner', 'gm', 'player');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null, display_name text not null, avatar_url text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_display_name_length check (char_length(display_name) between 1 and 60)
);
create unique index profiles_username_lower_key on public.profiles(lower(username));

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  description text check (description is null or char_length(description) <= 2000),
  cover_url text, owner_id uuid not null references public.profiles(id) on delete restrict,
  system_name text check (system_name is null or char_length(system_name) <= 100),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.campaign_members (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.campaign_role not null default 'player', joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);
create index campaign_members_user_id_idx on public.campaign_members(user_id);

create table public.campaign_invites (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  code text not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  created_by uuid not null references public.profiles(id) on delete cascade,
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  expires_at timestamptz, created_at timestamptz not null default now()
);
create unique index campaign_invites_code_upper_key on public.campaign_invites(upper(code));
create index campaign_invites_campaign_id_idx on public.campaign_invites(campaign_id);

alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
alter table public.campaign_invites enable row level security;

create function public.current_user_is_campaign_member(target_campaign_id uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists(select 1 from public.campaign_members where campaign_id=target_campaign_id and user_id=(select auth.uid()));
$$;
create function public.current_user_campaign_role(target_campaign_id uuid)
returns public.campaign_role language sql security definer stable set search_path = '' as $$
  select role from public.campaign_members where campaign_id=target_campaign_id and user_id=(select auth.uid());
$$;
revoke all on function public.current_user_is_campaign_member(uuid) from public, anon, authenticated;
revoke all on function public.current_user_campaign_role(uuid) from public, anon, authenticated;

create policy "authenticated users can read profiles" on public.profiles for select to authenticated using (true);
create policy "users can update their profile" on public.profiles for update to authenticated
  using (id=(select auth.uid())) with check (id=(select auth.uid()));
create policy "members can read campaigns" on public.campaigns for select to authenticated
  using (public.current_user_is_campaign_member(id));
create policy "authenticated users can create campaigns" on public.campaigns for insert to authenticated
  with check (owner_id=(select auth.uid()));
create policy "owners and gms can update campaign details" on public.campaigns for update to authenticated
  using (public.current_user_campaign_role(id) in ('owner','gm'))
  with check (public.current_user_campaign_role(id) in ('owner','gm'));
create policy "only owners can delete campaigns" on public.campaigns for delete to authenticated
  using (owner_id=(select auth.uid()));
create policy "members can read campaign memberships" on public.campaign_members for select to authenticated
  using (public.current_user_is_campaign_member(campaign_id));
create policy "members can leave a campaign" on public.campaign_members for delete to authenticated
  using (user_id=(select auth.uid()) and role <> 'owner');
create policy "admins can read campaign invites" on public.campaign_invites for select to authenticated
  using (public.current_user_campaign_role(campaign_id) in ('owner','gm'));
create policy "admins can create campaign invites" on public.campaign_invites for insert to authenticated
  with check (public.current_user_campaign_role(campaign_id) in ('owner','gm') and created_by=(select auth.uid()));
create policy "admins can revoke campaign invites" on public.campaign_invites for delete to authenticated
  using (public.current_user_campaign_role(campaign_id) in ('owner','gm'));

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare u text:=lower(trim(coalesce(new.raw_user_meta_data->>'username',''))); d text:=trim(coalesce(new.raw_user_meta_data->>'display_name',''));
begin
  if u !~ '^[a-z0-9_]{3,20}$' then raise exception using errcode='22023',message='invalid_username'; end if;
  if char_length(d) not between 1 and 60 then raise exception using errcode='22023',message='invalid_display_name'; end if;
  insert into public.profiles(id,username,display_name) values(new.id,u,d); return new;
exception when unique_violation then raise exception using errcode='23505',message='username_taken'; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.handle_new_campaign() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.campaign_members(campaign_id,user_id,role) values(new.id,new.owner_id,'owner'); return new; end; $$;
create trigger on_campaign_created after insert on public.campaigns for each row execute function public.handle_new_campaign();

create function public.protect_campaign_owner() returns trigger language plpgsql set search_path = '' as $$
begin if new.owner_id is distinct from old.owner_id then raise exception using errcode='42501',message='owner_id_cannot_be_updated_directly'; end if; return new; end; $$;
create trigger campaigns_protect_owner before update on public.campaigns for each row execute function public.protect_campaign_owner();
create function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at=now(); return new; end; $$;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger campaigns_set_updated_at before update on public.campaigns for each row execute function public.set_updated_at();

create type public.invite_preview as (campaign_id uuid,campaign_name text,campaign_description text,gm_display_name text,valid boolean);
create function public.preview_invite(invite_code text) returns public.invite_preview language sql security definer stable set search_path = '' as $$
  select c.id,c.name,c.description,p.display_name,
    (i.expires_at is null or i.expires_at>now()) and (i.max_uses is null or i.use_count<i.max_uses)
  from public.campaign_invites i join public.campaigns c on c.id=i.campaign_id join public.profiles p on p.id=c.owner_id
  where upper(i.code)=upper(trim(invite_code)); $$;

create function public.accept_invite(invite_code text) returns uuid language plpgsql security definer set search_path = '' as $$
declare caller uuid:=auth.uid(); inv public.campaign_invites%rowtype; inserted_count integer;
begin
  if caller is null then raise exception using errcode='28000',message='authentication_required'; end if;
  select * into inv from public.campaign_invites where upper(code)=upper(trim(invite_code)) for update;
  if not found then raise exception using errcode='P0002',message='invite_not_found'; end if;
  if inv.expires_at is not null and inv.expires_at<=now() then raise exception using errcode='22023',message='invite_expired'; end if;
  if exists(select 1 from public.campaign_members where campaign_id=inv.campaign_id and user_id=caller) then return inv.campaign_id; end if;
  if inv.max_uses is not null and inv.use_count>=inv.max_uses then raise exception using errcode='22023',message='invite_exhausted'; end if;
  insert into public.campaign_members(campaign_id,user_id,role) values(inv.campaign_id,caller,'player') on conflict do nothing;
  get diagnostics inserted_count=row_count;
  if inserted_count=1 then update public.campaign_invites set use_count=use_count+1 where id=inv.id; end if;
  return inv.campaign_id;
end; $$;

create function public.update_my_profile(new_username text,new_display_name text,new_avatar_url text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare caller uuid:=auth.uid(); begin
  if caller is null then raise exception using errcode='28000',message='authentication_required'; end if;
  new_username:=lower(trim(new_username)); new_display_name:=trim(new_display_name);
  if new_username !~ '^[a-z0-9_]{3,20}$' then raise exception using errcode='22023',message='invalid_username'; end if;
  if char_length(new_display_name) not between 1 and 60 then raise exception using errcode='22023',message='invalid_display_name'; end if;
  update public.profiles set username=new_username,display_name=new_display_name,avatar_url=nullif(trim(new_avatar_url),'') where id=caller;
exception when unique_violation then raise exception using errcode='23505',message='username_taken'; end; $$;

-- Somente o owner altera papéis; o papel owner nunca é promovido/rebaixado por esta RPC.
create function public.set_campaign_member_role(target_campaign_id uuid,target_user_id uuid,new_role public.campaign_role)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.current_user_campaign_role(target_campaign_id) <> 'owner' then raise exception using errcode='42501',message='owner_required'; end if;
  if new_role='owner' then raise exception using errcode='42501',message='ownership_transfer_requires_dedicated_flow'; end if;
  update public.campaign_members set role=new_role
  where campaign_id=target_campaign_id and user_id=target_user_id and role<>'owner';
  if not found then raise exception using errcode='P0002',message='member_not_found_or_protected'; end if;
end; $$;

-- Owner remove GM/player; GM remove apenas player; ninguém remove o owner.
create function public.remove_campaign_member(target_campaign_id uuid,target_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare caller_role public.campaign_role; target_role public.campaign_role;
begin
  caller_role:=public.current_user_campaign_role(target_campaign_id);
  select role into target_role from public.campaign_members where campaign_id=target_campaign_id and user_id=target_user_id for update;
  if not found or target_role='owner' then raise exception using errcode='42501',message='member_not_found_or_protected'; end if;
  if caller_role='owner' or (caller_role='gm' and target_role='player') then
    delete from public.campaign_members where campaign_id=target_campaign_id and user_id=target_user_id;
  else raise exception using errcode='42501',message='insufficient_campaign_role'; end if;
end; $$;

revoke execute on function public.handle_new_user() from public,anon,authenticated;
revoke execute on function public.handle_new_campaign() from public,anon,authenticated;
revoke execute on function public.protect_campaign_owner() from public,anon,authenticated;
revoke execute on function public.set_updated_at() from public,anon,authenticated;
revoke execute on function public.preview_invite(text) from public,anon,authenticated;
revoke execute on function public.accept_invite(text) from public,anon,authenticated;
revoke execute on function public.update_my_profile(text,text,text) from public,anon,authenticated;
revoke execute on function public.set_campaign_member_role(uuid,uuid,public.campaign_role) from public,anon,authenticated;
revoke execute on function public.remove_campaign_member(uuid,uuid) from public,anon,authenticated;
grant execute on function public.preview_invite(text) to anon,authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.update_my_profile(text,text,text) to authenticated;
grant execute on function public.set_campaign_member_role(uuid,uuid,public.campaign_role) to authenticated;
grant execute on function public.remove_campaign_member(uuid,uuid) to authenticated;
grant usage on schema public to anon,authenticated;
grant select on public.profiles,public.campaigns,public.campaign_members to authenticated;
grant insert,update,delete on public.campaigns to authenticated;
grant select,insert,delete on public.campaign_invites to authenticated;
grant delete on public.campaign_members to authenticated;
