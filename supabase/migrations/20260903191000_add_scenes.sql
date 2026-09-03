create table public.scenes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  background_url text,
  width integer not null default 1920 check (width > 0),
  height integer not null default 1080 check (height > 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index scenes_campaign_id_idx
on public.scenes(campaign_id);

alter table public.scenes enable row level security;

create policy "campaign members can read scenes"
on public.scenes
for select
to authenticated
using (
  public.current_user_is_campaign_member(campaign_id)
  or exists (
    select 1
    from public.campaigns
    where campaigns.id = scenes.campaign_id
      and campaigns.owner_id = (select auth.uid())
  )
);

create policy "owners and gms can create scenes"
on public.scenes
for insert
to authenticated
with check (
  public.current_user_campaign_role(campaign_id) in ('owner', 'gm')
);

create policy "owners and gms can update scenes"
on public.scenes
for update
to authenticated
using (
  public.current_user_campaign_role(campaign_id) in ('owner', 'gm')
)
with check (
  public.current_user_campaign_role(campaign_id) in ('owner', 'gm')
);

create policy "owners and gms can delete scenes"
on public.scenes
for delete
to authenticated
using (
  public.current_user_campaign_role(campaign_id) in ('owner', 'gm')
);

grant select on public.scenes to authenticated;
grant insert, update, delete on public.scenes to authenticated;