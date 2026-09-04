create table public.assets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now()
);

create index assets_campaign_id_idx
on public.assets(campaign_id);

alter table public.assets enable row level security;

create policy "campaign members can read assets"
on public.assets
for select
to authenticated
using (
  public.current_user_is_campaign_member(campaign_id)
  or exists (
    select 1
    from public.campaigns
    where campaigns.id = assets.campaign_id
      and campaigns.owner_id = (select auth.uid())
  )
);

create policy "owners and gms can create assets"
on public.assets
for insert
to authenticated
with check (
  public.current_user_campaign_role(campaign_id) in ('owner', 'gm')
  and uploaded_by = (select auth.uid())
);

create policy "owners and gms can delete assets"
on public.assets
for delete
to authenticated
using (
  public.current_user_campaign_role(campaign_id) in ('owner', 'gm')
);

grant select, insert, delete
on public.assets
to authenticated;