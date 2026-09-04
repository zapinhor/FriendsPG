drop policy if exists "campaign members can read scenes"
on public.scenes;

create policy "campaign members can read scenes"
on public.scenes
for select
to authenticated
using (
  public.current_user_campaign_role(campaign_id) in ('owner', 'gm')
  or (
    is_active = true
    and public.current_user_is_campaign_member(campaign_id)
  )
);