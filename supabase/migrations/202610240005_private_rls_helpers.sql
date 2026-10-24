-- Keep SECURITY DEFINER membership helpers out of PostgREST's exposed public schema.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_company_member(p_company_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (
  select 1 from public.company_members m
  where m.company_id = p_company_id
    and m.user_id = (select auth.uid())
    and m.status::text = 'active'
    and m.deleted_at is null
); $$;

create or replace function private.has_company_role(target_company uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (
  select 1 from public.company_members m
  where m.company_id = target_company
    and m.user_id = (select auth.uid())
    and m.status::text = 'active'
    and m.deleted_at is null
    and (
      m.role::text = any(allowed_roles)
      or (m.role::text = 'bid_manager' and 'tender_manager' = any(allowed_roles))
      or (m.role::text = 'technical_user' and 'estimator' = any(allowed_roles))
    )
); $$;

create or replace function private.has_company_role(p_company_id uuid, p_roles public.company_role[])
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (
  select 1 from public.company_members cm
  where cm.company_id = p_company_id
    and cm.user_id = (select auth.uid())
    and cm.role = any(p_roles)
    and cm.status = 'active'
    and cm.deleted_at is null
); $$;

grant execute on function private.is_company_member(uuid) to authenticated, service_role;
grant execute on function private.has_company_role(uuid, text[]) to authenticated, service_role;
grant execute on function private.has_company_role(uuid, public.company_role[]) to authenticated, service_role;

do $$
declare p record; new_qual text; new_check text; role_list text; policy_sql text;
begin
  for p in
    select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies
    where schemaname in ('public','storage')
      and (
        coalesce(qual,'') like '%public.has_company_role%'
        or coalesce(qual,'') like '%public.is_company_member%'
        or coalesce(with_check,'') like '%public.has_company_role%'
        or coalesce(with_check,'') like '%public.is_company_member%'
      )
  loop
    new_qual := replace(replace(p.qual, 'public.has_company_role', 'private.has_company_role'), 'public.is_company_member', 'private.is_company_member');
    new_check := replace(replace(p.with_check, 'public.has_company_role', 'private.has_company_role'), 'public.is_company_member', 'private.is_company_member');
    role_list := array_to_string(p.roles, ', ');
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    policy_sql := format('create policy %I on %I.%I as %s for %s to %s',
      p.policyname, p.schemaname, p.tablename, lower(p.permissive), p.cmd, role_list);
    if new_qual is not null then policy_sql := policy_sql || format(' using (%s)', new_qual); end if;
    if new_check is not null then policy_sql := policy_sql || format(' with check (%s)', new_check); end if;
    execute policy_sql;
  end loop;
end $$;

revoke execute on function public.is_company_member(uuid) from public, anon, authenticated;
revoke execute on function public.has_company_role(uuid, text[]) from public, anon, authenticated;
revoke execute on function public.has_company_role(uuid, public.company_role[]) from public, anon, authenticated;
