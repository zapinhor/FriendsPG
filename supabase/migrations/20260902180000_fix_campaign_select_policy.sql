drop policy if exists "members can read campaigns"
on public.campaigns;

create policy "members can read campaigns"
on public.campaigns
for select
to authenticated
using (
  owner_id = (select auth.uid())
  or public.current_user_is_campaign_member(id)
);
