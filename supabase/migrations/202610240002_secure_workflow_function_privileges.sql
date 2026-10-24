-- Trigger functions are invoked by PostgreSQL triggers and must not be callable as public RPC endpoints.
revoke all on function public.add_company_creator_as_owner() from public, anon, authenticated;
revoke all on function public.guard_company_member_role_changes() from public, anon, authenticated;
revoke all on function public.log_tender_lifecycle_event() from public, anon, authenticated;
revoke all on function public.prevent_tender_event_mutation() from public, anon, authenticated;
revoke all on function public.guard_proposal_approval() from public, anon, authenticated;
revoke all on function public.guard_submission_transition() from public, anon, authenticated;
revoke all on function public.prevent_last_company_owner_delete() from public, anon, authenticated;
