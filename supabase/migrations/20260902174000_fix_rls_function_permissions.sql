-- Grant execute on RLS helper functions to authenticated.
grant execute on function public.current_user_is_campaign_member(uuid) to authenticated;

grant execute on function public.current_user_campaign_role(uuid) to authenticated;