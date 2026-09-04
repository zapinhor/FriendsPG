create policy "campaign members can read campaign assets"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'campaign-assets'
  and exists (
    select 1
    from public.assets a
    where a.storage_path = storage.objects.name
      and (
        public.current_user_is_campaign_member(a.campaign_id)
        or exists (
          select 1
          from public.campaigns c
          where c.id = a.campaign_id
            and c.owner_id = (select auth.uid())
        )
      )
  )
);

create policy "owners and gms can upload campaign assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'campaign-assets'
  and split_part(name, '/', 1) <> ''
  and public.current_user_campaign_role(
    split_part(name, '/', 1)::uuid
  ) in ('owner', 'gm')
);

create policy "owners and gms can delete campaign assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'campaign-assets'
  and public.current_user_campaign_role(
    split_part(name, '/', 1)::uuid
  ) in ('owner', 'gm')
);