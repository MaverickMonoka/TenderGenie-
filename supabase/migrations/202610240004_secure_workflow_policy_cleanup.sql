-- Remove overlapping permissive policies and express workflow authorization in a single policy per action.
drop policy if exists "admins manage memberships" on public.company_members;
drop policy if exists "admins insert memberships" on public.company_members;
drop policy if exists "admins update memberships" on public.company_members;
drop policy if exists "admins delete memberships" on public.company_members;
create policy "admins insert memberships" on public.company_members for insert to authenticated
with check (public.has_company_role(company_id,array['owner','admin']));
create policy "admins update memberships" on public.company_members for update to authenticated
using (public.has_company_role(company_id,array['owner','admin']))
with check (public.has_company_role(company_id,array['owner','admin']));
create policy "admins delete memberships" on public.company_members for delete to authenticated
using (public.has_company_role(company_id,array['owner','admin']));

drop policy if exists "authors update draft proposals" on public.proposals;
drop policy if exists "managers approve proposals" on public.proposals;
drop policy if exists "authorized proposal workflow updates" on public.proposals;
create policy "authorized proposal workflow updates" on public.proposals for update to authenticated
using (
  (public.has_company_role(company_id,array['owner','admin','tender_manager','estimator']) and status in ('draft','internal_review'))
  or (public.has_company_role(company_id,array['owner','admin','tender_manager']) and status in ('internal_review','approved','locked'))
)
with check (
  (public.has_company_role(company_id,array['owner','admin','tender_manager','estimator']) and status in ('draft','internal_review'))
  or (public.has_company_role(company_id,array['owner','admin','tender_manager']) and status in ('approved','locked','superseded'))
);
