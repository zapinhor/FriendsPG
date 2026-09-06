-- Phase 5: authorize private Broadcast channels named scene:<scene uuid>.
-- Members can receive movement previews for scenes they may view. Only
-- Owner/GM can publish them, matching the persistent scene_props policies.
create policy "campaign members can receive scene broadcasts"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) ~ '^scene:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  and exists (
    select 1
    from public.scenes s
    where s.id = split_part((select realtime.topic()), ':', 2)::uuid
      and (
        public.current_user_campaign_role(s.campaign_id) in ('owner', 'gm')
        or (
          public.current_user_campaign_role(s.campaign_id) = 'player'
          and s.is_active = true
        )
      )
  )
);

create policy "owners and gms can send scene broadcasts"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) ~ '^scene:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  and exists (
    select 1
    from public.scenes s
    where s.id = split_part((select realtime.topic()), ':', 2)::uuid
      and public.current_user_campaign_role(s.campaign_id) in ('owner', 'gm')
  )
);
