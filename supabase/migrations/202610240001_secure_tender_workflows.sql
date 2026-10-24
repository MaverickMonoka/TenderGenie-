-- TenderGenie core tenancy and tender lifecycle schema
-- Apply with Supabase CLI after reviewing against the target project.
create extension if not exists pgcrypto;
create table if not exists public.companies (
 id uuid primary key default gen_random_uuid(), name text not null check (length(trim(name)) between 2 and 180),
 registration_number text, tax_number text, cidb_grade text, cidb_categories text[] not null default '{}',
 csd_number text, province text, service_categories text[] not null default '{}',
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.company_members (
 company_id uuid not null references public.companies(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null default 'estimator' check (role in ('owner','admin','tender_manager','estimator','viewer')),
 created_at timestamptz not null default now(), primary key (company_id,user_id)
);
create table if not exists public.tenders (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 source_name text not null, source_url text, reference_number text, title text not null, buyer_name text, description text,
 province text, categories text[] not null default '{}', published_at timestamptz, clarification_deadline timestamptz,
 closing_at timestamptz, estimated_value numeric(16,2) check (estimated_value is null or estimated_value >= 0),
 status text not null default 'discovered' check (status in ('discovered','screening','qualified','no_bid','bid_approved','estimating','compliance','proposal','ready_for_approval','submitted','awarded','unsuccessful','cancelled','closed')),
 source_snapshot jsonb not null default '{}'::jsonb, created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (company_id,source_name,reference_number)
);
create table if not exists public.documents (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 tender_id uuid references public.tenders(id) on delete set null, storage_path text not null unique,
 original_filename text not null, mime_type text not null, byte_size bigint not null check (byte_size > 0),
 sha256 text, document_type text not null default 'other',
 extraction_status text not null default 'pending' check (extraction_status in ('pending','processing','complete','failed','needs_review')),
 extracted_text text, extracted_fields jsonb not null default '{}'::jsonb,
 uploaded_by uuid not null references auth.users(id) on delete restrict, created_at timestamptz not null default now()
);
create table if not exists public.eligibility_checks (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 tender_id uuid not null references public.tenders(id) on delete cascade, criterion text not null,
 result text not null check (result in ('pass','fail','review','unknown')),
 evidence_document_id uuid references public.documents(id) on delete set null, explanation text not null,
 checked_by uuid references auth.users(id) on delete set null, checked_at timestamptz not null default now()
);
create table if not exists public.rate_sources (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 source_type text not null check (source_type in ('supplier_quote','historical_actual','published_schedule','internal_rate','estimator_assumption','subcontractor_quote')),
 source_name text not null, source_reference text, source_date date, valid_until date,
 document_id uuid references public.documents(id) on delete set null, verified_by uuid references auth.users(id) on delete set null,
 verified_at timestamptz, notes text, created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(), check (valid_until is null or source_date is null or valid_until >= source_date)
);
create table if not exists public.construction_rates (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 rate_source_id uuid not null references public.rate_sources(id) on delete restrict, item_code text, description text not null,
 trade text not null, unit text not null, rate_type text not null check (rate_type in ('material','labour','plant','subcontract','composite')),
 unit_rate numeric(16,4) not null check (unit_rate >= 0), currency text not null default 'ZAR' check (currency = 'ZAR'),
 region text, effective_from date not null default current_date, effective_to date, assumptions text,
 created_by uuid not null references auth.users(id) on delete restrict, created_at timestamptz not null default now(),
 check (effective_to is null or effective_to >= effective_from)
);
create table if not exists public.boq_projects (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 tender_id uuid references public.tenders(id) on delete set null, name text not null,
 revision integer not null default 1 check (revision > 0), status text not null default 'draft' check (status in ('draft','review','approved','superseded')),
 preliminaries numeric(16,2) not null default 0 check (preliminaries >= 0),
 contingency_percent numeric(6,3) not null default 0 check (contingency_percent between 0 and 100),
 markup_percent numeric(6,3) not null default 0 check (markup_percent between 0 and 100),
 created_by uuid not null references auth.users(id) on delete restrict, approved_by uuid references auth.users(id) on delete set null,
 approved_at timestamptz, created_at timestamptz not null default now(), unique (company_id,tender_id,name,revision)
);
create table if not exists public.boq_items (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 boq_project_id uuid not null references public.boq_projects(id) on delete cascade, item_number text not null,
 description text not null, unit text not null, quantity numeric(16,4) not null check (quantity >= 0),
 rate_id uuid references public.construction_rates(id) on delete restrict,
 rate_source_id uuid references public.rate_sources(id) on delete restrict,
 unit_rate numeric(16,4) not null check (unit_rate >= 0),
 rate_basis text not null check (rate_basis in ('approved_rate','supplier_quote','historical_actual','published_schedule','estimator_assumption','manual_override')),
 rate_note text, calculated_amount numeric(18,2) generated always as (round(quantity * unit_rate, 2)) stored,
 created_at timestamptz not null default now(), unique (boq_project_id,item_number),
 check (rate_basis <> 'estimator_assumption' or length(trim(coalesce(rate_note,''))) > 0),
 check (rate_basis <> 'manual_override' or length(trim(coalesce(rate_note,''))) > 0)
);
create table if not exists public.proposals (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 tender_id uuid not null references public.tenders(id) on delete cascade, boq_project_id uuid references public.boq_projects(id) on delete set null,
 version integer not null default 1 check (version > 0),
 status text not null default 'draft' check (status in ('draft','internal_review','approved','locked','superseded')),
 title text not null, content jsonb not null default '{}'::jsonb, generated_document_id uuid references public.documents(id) on delete set null,
 created_by uuid not null references auth.users(id) on delete restrict, approved_by uuid references auth.users(id) on delete set null,
 approved_at timestamptz, locked_at timestamptz, created_at timestamptz not null default now(), unique (tender_id,version)
);
create table if not exists public.submissions (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 tender_id uuid not null references public.tenders(id) on delete cascade, proposal_id uuid not null references public.proposals(id) on delete restrict,
 status text not null default 'pending_approval' check (status in ('pending_approval','approved_to_submit','submitted','receipt_confirmed','rejected','withdrawn')),
 submission_method text, destination text, approved_by uuid references auth.users(id) on delete set null, approved_at timestamptz,
 submitted_by uuid references auth.users(id) on delete set null, submitted_at timestamptz, receipt_reference text,
 receipt_document_id uuid references public.documents(id) on delete set null, submission_notes text, created_at timestamptz not null default now(),
 check (status not in ('submitted','receipt_confirmed') or (submitted_at is not null and submitted_by is not null)),
 check (status <> 'approved_to_submit' or (approved_at is not null and approved_by is not null))
);
create table if not exists public.tender_events (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 tender_id uuid not null references public.tenders(id) on delete cascade, actor_id uuid references auth.users(id) on delete set null,
 event_type text not null, from_status text, to_status text, details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

-- Compatibility bridge for the pre-existing TenderGenie schema. These tables already
-- exist in production with legacy columns/types, so evolve them additively instead
-- of relying on CREATE TABLE IF NOT EXISTS to replace their structure.
alter table public.companies
  add column if not exists service_categories text[] not null default '{}',
  add column if not exists cidb_categories text[] not null default '{}',
  add column if not exists cidb_grade text;
alter table public.company_members
  add column if not exists updated_at timestamptz not null default now();
create unique index if not exists company_members_company_user_unique
  on public.company_members(company_id,user_id);
alter table public.tenders
  add column if not exists source_name text not null default 'Manual entry',
  add column if not exists reference_number text,
  add column if not exists buyer_name text,
  add column if not exists categories text[] not null default '{}',
  add column if not exists published_at timestamptz,
  add column if not exists clarification_deadline timestamptz,
  add column if not exists estimated_value numeric(16,2),
  add column if not exists source_snapshot jsonb not null default '{}'::jsonb;
alter table public.proposals
  add column if not exists boq_project_id uuid,
  add column if not exists content jsonb not null default '{}'::jsonb,
  add column if not exists generated_document_id uuid,
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists locked_at timestamptz;
alter table public.boq_items
  add column if not exists boq_project_id uuid,
  add column if not exists item_number text,
  add column if not exists rate_id uuid,
  add column if not exists rate_source_id uuid,
  add column if not exists unit_rate numeric(16,4) not null default 0,
  add column if not exists rate_basis text not null default 'estimator_assumption',
  add column if not exists rate_note text,
  add column if not exists calculated_amount numeric(18,2)
    generated always as (round(quantity * unit_rate, 2)) stored;
alter table public.boq_items alter column tender_id drop not null;
create unique index if not exists tenders_company_source_reference_unique
  on public.tenders(company_id,source_name,reference_number);

create index if not exists tenders_company_status_closing_idx on public.tenders(company_id,status,closing_at);
create index if not exists documents_company_tender_idx on public.documents(company_id,tender_id,created_at desc);
create index if not exists rates_company_trade_region_idx on public.construction_rates(company_id,trade,region,effective_from desc);
create index if not exists boq_items_project_idx on public.boq_items(boq_project_id);
create index if not exists tender_events_tender_idx on public.tender_events(tender_id,created_at desc);

create or replace function public.is_company_member(p_company_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.company_members m where m.company_id = p_company_id and m.user_id = (select auth.uid()) and m.status::text = 'active' and m.deleted_at is null); $$;
create or replace function public.has_company_role(target_company uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.company_members m where m.company_id = target_company and m.user_id = (select auth.uid()) and m.status::text = 'active' and m.deleted_at is null and (m.role::text = any(allowed_roles) or (m.role::text = 'bid_manager' and 'tender_manager' = any(allowed_roles)) or (m.role::text = 'technical_user' and 'estimator' = any(allowed_roles)))); $$;
create or replace function public.add_company_creator_as_owner()
returns trigger language plpgsql security definer set search_path = ''
as $$ begin insert into public.company_members(company_id,user_id,role) values (new.id,new.created_by,'owner') on conflict do nothing; return new; end; $$;
drop trigger if exists companies_add_creator on public.companies;
create trigger companies_add_creator after insert on public.companies for each row execute function public.add_company_creator_as_owner();

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.tenders enable row level security;
alter table public.eligibility_checks enable row level security;
alter table public.documents enable row level security;
alter table public.rate_sources enable row level security;
alter table public.construction_rates enable row level security;
alter table public.boq_projects enable row level security;
alter table public.boq_items enable row level security;
alter table public.proposals enable row level security;
alter table public.submissions enable row level security;
alter table public.tender_events enable row level security;


-- Remove permissive legacy policies before installing role-aware equivalents.
drop policy if exists "companies_select_member" on public.companies;
drop policy if exists "companies_insert_authenticated" on public.companies;
drop policy if exists "companies_update_admin" on public.companies;
drop policy if exists "company_members_select" on public.company_members;
drop policy if exists "company_members_insert_admin" on public.company_members;
drop policy if exists "company_members_update_admin" on public.company_members;
drop policy if exists "company_members_delete_owner" on public.company_members;
drop policy if exists "tenders_select_member" on public.tenders;
drop policy if exists "tenders_insert_member" on public.tenders;
drop policy if exists "tenders_update_member" on public.tenders;
drop policy if exists "tenders_delete_admin" on public.tenders;
drop policy if exists "proposals_select_member" on public.proposals;
drop policy if exists "proposals_insert_member" on public.proposals;
drop policy if exists "proposals_update_member" on public.proposals;
drop policy if exists "proposals_delete_admin" on public.proposals;
drop policy if exists "boq_select_member" on public.boq_items;
drop policy if exists "boq_insert_member" on public.boq_items;
drop policy if exists "boq_update_member" on public.boq_items;
drop policy if exists "boq_delete_member" on public.boq_items;

create policy "company members read company" on public.companies for select to authenticated using (public.is_company_member(id));
create policy "authenticated users create company" on public.companies for insert to authenticated with check (created_by = (select auth.uid()));
create policy "company admins update company" on public.companies for update to authenticated using (public.has_company_role(id,array['owner','admin'])) with check (public.has_company_role(id,array['owner','admin']));
create policy "members read memberships" on public.company_members for select to authenticated using (public.is_company_member(company_id));
create policy "admins manage memberships" on public.company_members for all to authenticated using (public.has_company_role(company_id,array['owner','admin'])) with check (public.has_company_role(company_id,array['owner','admin']));
create policy "members manage tenders" on public.tenders for all to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy "members manage eligibility" on public.eligibility_checks for all to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy "members manage documents" on public.documents for all to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id) and uploaded_by = (select auth.uid()));
create policy "members read rate sources" on public.rate_sources for select to authenticated using (public.is_company_member(company_id));
create policy "estimators insert rate sources" on public.rate_sources for insert to authenticated with check (public.has_company_role(company_id,array['owner','admin','tender_manager','estimator']) and created_by = (select auth.uid()));
create policy "estimators update rate sources" on public.rate_sources for update to authenticated using (public.has_company_role(company_id,array['owner','admin','tender_manager','estimator'])) with check (public.has_company_role(company_id,array['owner','admin','tender_manager','estimator']));
create policy "members read construction rates" on public.construction_rates for select to authenticated using (public.is_company_member(company_id));
create policy "estimators manage construction rates" on public.construction_rates for all to authenticated using (public.has_company_role(company_id,array['owner','admin','tender_manager','estimator'])) with check (public.has_company_role(company_id,array['owner','admin','tender_manager','estimator']) and created_by = (select auth.uid()));
create policy "members manage boq projects" on public.boq_projects for all to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id) and created_by = (select auth.uid()));
create policy "members manage boq items" on public.boq_items for all to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy "members read proposals" on public.proposals for select to authenticated using (public.is_company_member(company_id));
create policy "authors create draft proposals" on public.proposals for insert to authenticated with check (public.is_company_member(company_id) and created_by = (select auth.uid()) and status = 'draft');
create policy "authors update draft proposals" on public.proposals for update to authenticated using (public.has_company_role(company_id,array['owner','admin','tender_manager','estimator']) and status in ('draft','internal_review')) with check (public.has_company_role(company_id,array['owner','admin','tender_manager','estimator']) and status in ('draft','internal_review'));
create policy "members read submissions" on public.submissions for select to authenticated using (public.is_company_member(company_id));
create policy "managers create submissions" on public.submissions for insert to authenticated with check (public.has_company_role(company_id,array['owner','admin','tender_manager']) and status = 'pending_approval');
create policy "managers update submissions" on public.submissions for update to authenticated using (public.has_company_role(company_id,array['owner','admin','tender_manager'])) with check (public.has_company_role(company_id,array['owner','admin','tender_manager']));
create policy "members read tender events" on public.tender_events for select to authenticated using (public.is_company_member(company_id));
create policy "members append tender events" on public.tender_events for insert to authenticated with check (public.is_company_member(company_id) and actor_id = (select auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('tender-documents','tender-documents',false,26214400,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/png','image/jpeg','text/plain'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "company members read private tender files" on storage.objects for select to authenticated using (bucket_id='tender-documents' and public.is_company_member(((storage.foldername(name))[1])::uuid));
create policy "company members upload private tender files" on storage.objects for insert to authenticated with check (bucket_id='tender-documents' and public.is_company_member(((storage.foldername(name))[1])::uuid));
create policy "company admins delete private tender files" on storage.objects for delete to authenticated using (bucket_id='tender-documents' and public.has_company_role(((storage.foldername(name))[1])::uuid,array['owner','admin']));

-- Enforce same-company references at the database layer (not only in application code).
alter table public.tenders add constraint tenders_id_company_unique unique (id, company_id);
alter table public.documents add constraint documents_id_company_unique unique (id, company_id);
alter table public.rate_sources add constraint rate_sources_id_company_unique unique (id, company_id);
alter table public.construction_rates add constraint construction_rates_id_company_unique unique (id, company_id);
alter table public.boq_projects add constraint boq_projects_id_company_unique unique (id, company_id);
alter table public.proposals add constraint proposals_id_company_unique unique (id, company_id);

alter table public.documents add constraint documents_tender_same_company_fk
 foreign key (tender_id, company_id) references public.tenders(id, company_id) on delete set null (tender_id);
alter table public.eligibility_checks add constraint eligibility_tender_same_company_fk
 foreign key (tender_id, company_id) references public.tenders(id, company_id) on delete cascade;
alter table public.eligibility_checks add constraint eligibility_document_same_company_fk
 foreign key (evidence_document_id, company_id) references public.documents(id, company_id) on delete set null (evidence_document_id);
alter table public.rate_sources add constraint rate_source_document_same_company_fk
 foreign key (document_id, company_id) references public.documents(id, company_id) on delete set null (document_id);
alter table public.construction_rates add constraint construction_rate_source_same_company_fk
 foreign key (rate_source_id, company_id) references public.rate_sources(id, company_id) on delete restrict;
alter table public.boq_projects add constraint boq_tender_same_company_fk
 foreign key (tender_id, company_id) references public.tenders(id, company_id) on delete set null (tender_id);
alter table public.boq_items add constraint boq_project_same_company_fk
 foreign key (boq_project_id, company_id) references public.boq_projects(id, company_id) on delete cascade;
alter table public.boq_items add constraint boq_rate_same_company_fk
 foreign key (rate_id, company_id) references public.construction_rates(id, company_id) on delete restrict;
alter table public.boq_items add constraint boq_rate_source_same_company_fk
 foreign key (rate_source_id, company_id) references public.rate_sources(id, company_id) on delete restrict;
alter table public.proposals add constraint proposal_tender_same_company_fk
 foreign key (tender_id, company_id) references public.tenders(id, company_id) on delete cascade;
alter table public.proposals add constraint proposal_boq_same_company_fk
 foreign key (boq_project_id, company_id) references public.boq_projects(id, company_id) on delete set null (boq_project_id);
alter table public.proposals add constraint proposal_document_same_company_fk
 foreign key (generated_document_id, company_id) references public.documents(id, company_id) on delete set null (generated_document_id);
alter table public.submissions add constraint submission_tender_same_company_fk
 foreign key (tender_id, company_id) references public.tenders(id, company_id) on delete cascade;
alter table public.submissions add constraint submission_proposal_same_company_fk
 foreign key (proposal_id, company_id) references public.proposals(id, company_id) on delete restrict;
alter table public.submissions add constraint submission_receipt_same_company_fk
 foreign key (receipt_document_id, company_id) references public.documents(id, company_id) on delete set null (receipt_document_id);
alter table public.tender_events add constraint tender_event_same_company_fk
 foreign key (tender_id, company_id) references public.tenders(id, company_id) on delete cascade;

-- Submission transitions require an approved, locked proposal and explicit actor metadata.
create or replace function public.guard_submission_transition()
returns trigger language plpgsql set search_path = ''
as $$
declare proposal_status text;
begin
 if tg_op = 'UPDATE' and old.status in ('submitted','receipt_confirmed','withdrawn','rejected') and new.status <> old.status then
   raise exception 'A final submission state cannot be reopened; create a new submission record.';
 end if;
 if new.status = 'approved_to_submit' then
   if new.approved_by is null or new.approved_at is null then
     raise exception 'Submission approval requires an approver and timestamp.';
   end if;
   select p.status into proposal_status from public.proposals p
    where p.id = new.proposal_id and p.company_id = new.company_id;
   if proposal_status not in ('approved','locked') then
     raise exception 'Only an approved or locked proposal can be approved for submission.';
   end if;
 end if;
 if new.status in ('submitted','receipt_confirmed') then
   if new.submitted_by is null or new.submitted_at is null then
     raise exception 'Submission requires the submitting user and timestamp.';
   end if;
   if tg_op = 'INSERT' or old.status <> 'approved_to_submit' and old.status <> 'submitted' then
     raise exception 'Submission must first be explicitly approved to submit.';
   end if;
 end if;
 return new;
end;
$$;
drop trigger if exists submissions_guard_transition on public.submissions;
create trigger submissions_guard_transition before insert or update on public.submissions
for each row execute function public.guard_submission_transition();

-- Allow designated managers to approve/lock proposals without permitting draft authors to self-approve.
create policy "managers approve proposals" on public.proposals for update to authenticated
using (public.has_company_role(company_id,array['owner','admin','tender_manager']) and status in ('internal_review','approved','locked'))
with check (public.has_company_role(company_id,array['owner','admin','tender_manager']) and status in ('approved','locked','superseded'));

create or replace function public.guard_proposal_approval()
returns trigger language plpgsql set search_path = ''
as $$
begin
 if new.status in ('approved','locked') and old.status not in ('approved','locked') then
   if new.approved_by is null or new.approved_at is null then
     raise exception 'Proposal approval requires an approver and timestamp.';
   end if;
 end if;
 if new.status = 'locked' and new.locked_at is null then
   raise exception 'Locking a proposal requires a locked timestamp.';
 end if;
 if old.status = 'locked' and new.status <> 'locked' then
   raise exception 'Locked proposals are immutable; create a new version.';
 end if;
 return new;
end;
$$;
drop trigger if exists proposals_guard_approval on public.proposals;
create trigger proposals_guard_approval before update on public.proposals
for each row execute function public.guard_proposal_approval();

-- Automatically append tender lifecycle events inside the same transaction as each state change.
create or replace function public.log_tender_lifecycle_event()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.tender_events(company_id,tender_id,actor_id,event_type,from_status,to_status,details)
    values (new.company_id,new.id,(select auth.uid()),'tender_created',null,new.status,
      jsonb_build_object('source_name',new.source_name,'reference_number',new.reference_number));
    return new;
  end if;
  if new.status is distinct from old.status then
    insert into public.tender_events(company_id,tender_id,actor_id,event_type,from_status,to_status,details)
    values (new.company_id,new.id,(select auth.uid()),'status_changed',old.status,new.status,'{}'::jsonb);
  end if;
  return new;
end;
$$;
drop trigger if exists tenders_log_lifecycle on public.tenders;
create trigger tenders_log_lifecycle after insert or update of status on public.tenders
for each row execute function public.log_tender_lifecycle_event();

-- Prevent ordinary authenticated clients from altering or deleting existing audit history.
create or replace function public.prevent_tender_event_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'Tender event history is append-only.';
end;
$$;
drop trigger if exists tender_events_immutable on public.tender_events;
create trigger tender_events_immutable before update or delete on public.tender_events
for each row execute function public.prevent_tender_event_mutation();

-- Tighten membership administration: admins cannot promote themselves or grant owner role.
create or replace function public.guard_company_member_role_changes()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare caller_is_owner boolean;
declare caller_is_admin boolean;
declare creator_id uuid;
begin
  select exists (
    select 1 from public.company_members m
    where m.company_id = new.company_id and m.user_id = (select auth.uid()) and m.role = 'owner'
  ) into caller_is_owner;
  select exists (
    select 1 from public.company_members m
    where m.company_id = new.company_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  ) into caller_is_admin;

  if tg_op = 'INSERT' then
    select c.created_by into creator_id from public.companies c where c.id = new.company_id;
    if new.role = 'owner' and not caller_is_owner
       and not (new.user_id = (select auth.uid()) and creator_id = (select auth.uid())) then
      raise exception 'Only an existing owner may grant owner role.';
    end if;
    if not caller_is_admin and not (new.user_id = (select auth.uid()) and creator_id = (select auth.uid()) and new.role = 'owner') then
      raise exception 'Only a company owner or admin may add members.';
    end if;
    return new;
  end if;

  if new.company_id <> old.company_id or new.user_id <> old.user_id then
    raise exception 'Company membership identity cannot be changed.';
  end if;
  if new.role is distinct from old.role then
    if new.user_id = (select auth.uid()) and not caller_is_owner then
      raise exception 'Members cannot change their own role.';
    end if;
    if new.role = 'owner' and not caller_is_owner then
      raise exception 'Only an existing owner may grant owner role.';
    end if;
    if not caller_is_admin then
      raise exception 'Only a company owner or admin may change member roles.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists company_members_guard_roles on public.company_members;
create trigger company_members_guard_roles before insert or update on public.company_members
for each row execute function public.guard_company_member_role_changes();

-- The lifecycle trigger is the only client-visible source of tender status events.
drop policy if exists "members append tender events" on public.tender_events;

-- Do not allow clients to spoof the identity of a proposal approver or submitter.
create or replace function public.guard_proposal_approval()
returns trigger language plpgsql set search_path = ''
as $$
begin
 if new.status in ('approved','locked') and old.status not in ('approved','locked') then
   if new.approved_by is null or new.approved_at is null then
     raise exception 'Proposal approval requires an approver and timestamp.';
   end if;
   if new.approved_by <> (select auth.uid()) then
     raise exception 'The approving user must match the authenticated user.';
   end if;
 end if;
 if new.status = 'locked' and new.locked_at is null then
   raise exception 'Locking a proposal requires a locked timestamp.';
 end if;
 if old.status = 'locked' and new.status <> 'locked' then
   raise exception 'Locked proposals are immutable; create a new version.';
 end if;
 return new;
end;
$$;

create or replace function public.guard_submission_transition()
returns trigger language plpgsql set search_path = ''
as $$
declare proposal_status text;
begin
 if tg_op = 'UPDATE' and old.status in ('submitted','receipt_confirmed','withdrawn','rejected') and new.status <> old.status then
   raise exception 'A final submission state cannot be reopened; create a new submission record.';
 end if;
 if new.status = 'approved_to_submit' then
   if new.approved_by is null or new.approved_at is null then
     raise exception 'Submission approval requires an approver and timestamp.';
   end if;
   if new.approved_by <> (select auth.uid()) then
     raise exception 'The approving user must match the authenticated user.';
   end if;
   select p.status into proposal_status from public.proposals p
    where p.id = new.proposal_id and p.company_id = new.company_id;
   if proposal_status not in ('approved','locked') then
     raise exception 'Only an approved or locked proposal can be approved for submission.';
   end if;
 end if;
 if new.status = 'submitted' then
   if new.submitted_by is null or new.submitted_at is null then
     raise exception 'Submission requires the submitting user and timestamp.';
   end if;
   if new.submitted_by <> (select auth.uid()) then
     raise exception 'The submitting user must match the authenticated user.';
   end if;
   if tg_op = 'INSERT' or old.status <> 'approved_to_submit' then
     raise exception 'Submission must first be explicitly approved to submit.';
   end if;
 end if;
 if new.status = 'receipt_confirmed' then
   if tg_op = 'INSERT' or old.status <> 'submitted' then
     raise exception 'Receipt can only be confirmed after submission.';
   end if;
   if length(trim(coalesce(new.receipt_reference,''))) = 0 and new.receipt_document_id is null then
     raise exception 'Receipt confirmation requires a receipt reference or receipt document.';
   end if;
 end if;
 return new;
end;
$$;

-- Restrict document metadata to read/create/update; delete only through a reviewed retention workflow.
drop policy if exists "members manage documents" on public.documents;
create policy "members read documents" on public.documents for select to authenticated
using (public.is_company_member(company_id));
create policy "members upload document metadata" on public.documents for insert to authenticated
with check (public.is_company_member(company_id) and uploaded_by = (select auth.uid()));
create policy "uploaders update document metadata" on public.documents for update to authenticated
using (public.is_company_member(company_id) and uploaded_by = (select auth.uid()))
with check (public.is_company_member(company_id) and uploaded_by = (select auth.uid()));

-- Apply role-aware write access to tender and estimating records. Existing permissive policies are removed first.
drop policy if exists "members manage tenders" on public.tenders;
create policy "members read tenders" on public.tenders for select to authenticated
using (public.is_company_member(company_id));
create policy "tender managers create tenders" on public.tenders for insert to authenticated
with check (public.has_company_role(company_id,array['owner','admin','tender_manager']) and created_by = (select auth.uid()));
create policy "tender managers update tenders" on public.tenders for update to authenticated
using (public.has_company_role(company_id,array['owner','admin','tender_manager']))
with check (public.has_company_role(company_id,array['owner','admin','tender_manager']));
create policy "company admins delete tenders" on public.tenders for delete to authenticated
using (public.has_company_role(company_id,array['owner','admin']));

drop policy if exists "members manage eligibility" on public.eligibility_checks;
create policy "members read eligibility" on public.eligibility_checks for select to authenticated
using (public.is_company_member(company_id));
create policy "estimators record eligibility" on public.eligibility_checks for insert to authenticated
with check (public.has_company_role(company_id,array['owner','admin','tender_manager','estimator']) and checked_by = (select auth.uid()));
create policy "estimators update eligibility" on public.eligibility_checks for update to authenticated
using (public.has_company_role(company_id,array['owner','admin','tender_manager','estimator']))
with check (public.has_company_role(company_id,array['owner','admin','tender_manager','estimator']) and checked_by = (select auth.uid()));
create policy "admins delete eligibility" on public.eligibility_checks for delete to authenticated
using (public.has_company_role(company_id,array['owner','admin']));

drop policy if exists "members manage boq projects" on public.boq_projects;
create policy "members read boq projects" on public.boq_projects for select to authenticated
using (public.is_company_member(company_id));
create policy "estimators create boq projects" on public.boq_projects for insert to authenticated
with check (public.has_company_role(company_id,array['owner','admin','tender_manager','estimator']) and created_by = (select auth.uid()));
create policy "estimators update boq projects" on public.boq_projects for update to authenticated
using (public.has_company_role(company_id,array['owner','admin','tender_manager','estimator']))
with check (public.has_company_role(company_id,array['owner','admin','tender_manager','estimator']));
create policy "admins delete boq projects" on public.boq_projects for delete to authenticated
using (public.has_company_role(company_id,array['owner','admin']));

drop policy if exists "members manage boq items" on public.boq_items;
create policy "members read boq items" on public.boq_items for select to authenticated
using (public.is_company_member(company_id));
create policy "estimators create boq items" on public.boq_items for insert to authenticated
with check (public.has_company_role(company_id,array['owner','admin','tender_manager','estimator']));
create policy "estimators update boq items" on public.boq_items for update to authenticated
using (public.has_company_role(company_id,array['owner','admin','tender_manager','estimator']))
with check (public.has_company_role(company_id,array['owner','admin','tender_manager','estimator']));
create policy "admins delete boq items" on public.boq_items for delete to authenticated
using (public.has_company_role(company_id,array['owner','admin']));

drop policy if exists "authors create draft proposals" on public.proposals;
create policy "estimators create draft proposals" on public.proposals for insert to authenticated
with check (public.has_company_role(company_id,array['owner','admin','tender_manager','estimator']) and created_by = (select auth.uid()) and status = 'draft');

-- Explicit Data API privileges; row-level policies above remain the row-level authorization boundary.
grant select, insert, update on public.companies to authenticated;
grant select, insert, update, delete on public.company_members to authenticated;
grant select, insert, update, delete on public.tenders to authenticated;
grant select, insert, update, delete on public.eligibility_checks to authenticated;
grant select, insert, update on public.documents to authenticated;
grant select, insert, update on public.rate_sources to authenticated;
grant select, insert, update, delete on public.construction_rates to authenticated;
grant select, insert, update, delete on public.boq_projects to authenticated;
grant select, insert, update, delete on public.boq_items to authenticated;
grant select, insert, update on public.proposals to authenticated;
grant select, insert, update on public.submissions to authenticated;
grant select on public.tender_events to authenticated;

revoke all on function public.is_company_member(uuid) from public, anon;
revoke all on function public.has_company_role(uuid,text[]) from public, anon;
grant execute on function public.is_company_member(uuid) to authenticated;
grant execute on function public.has_company_role(uuid,text[]) to authenticated;

-- A company must always retain at least one owner.
create or replace function public.guard_company_member_role_changes()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare caller_is_owner boolean;
declare caller_is_admin boolean;
declare creator_id uuid;
declare remaining_owners integer;
begin
  select exists (
    select 1 from public.company_members m
    where m.company_id = new.company_id and m.user_id = (select auth.uid()) and m.role = 'owner'
  ) into caller_is_owner;
  select exists (
    select 1 from public.company_members m
    where m.company_id = new.company_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  ) into caller_is_admin;

  if tg_op = 'INSERT' then
    select c.created_by into creator_id from public.companies c where c.id = new.company_id;
    if new.role = 'owner' and not caller_is_owner
       and not (new.user_id = (select auth.uid()) and creator_id = (select auth.uid())) then
      raise exception 'Only an existing owner may grant owner role.';
    end if;
    if not caller_is_admin and not (new.user_id = (select auth.uid()) and creator_id = (select auth.uid()) and new.role = 'owner') then
      raise exception 'Only a company owner or admin may add members.';
    end if;
    return new;
  end if;

  if new.company_id <> old.company_id or new.user_id <> old.user_id then
    raise exception 'Company membership identity cannot be changed.';
  end if;
  if new.role is distinct from old.role then
    if new.user_id = (select auth.uid()) and not caller_is_owner then
      raise exception 'Members cannot change their own role.';
    end if;
    if new.role = 'owner' and not caller_is_owner then
      raise exception 'Only an existing owner may grant owner role.';
    end if;
    if not caller_is_admin then
      raise exception 'Only a company owner or admin may change member roles.';
    end if;
    if old.role = 'owner' and new.role <> 'owner' then
      select count(*) into remaining_owners from public.company_members m
      where m.company_id = old.company_id and m.role = 'owner' and m.user_id <> old.user_id;
      if remaining_owners = 0 then
        raise exception 'A company must retain at least one owner.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.prevent_last_company_owner_delete()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare remaining_owners integer;
begin
  if old.role = 'owner' then
    select count(*) into remaining_owners from public.company_members m
    where m.company_id = old.company_id and m.role = 'owner' and m.user_id <> old.user_id;
    if remaining_owners = 0 then
      raise exception 'A company must retain at least one owner.';
    end if;
  end if;
  return old;
end;
$$;
drop trigger if exists company_members_prevent_last_owner_delete on public.company_members;
create trigger company_members_prevent_last_owner_delete before delete on public.company_members
for each row execute function public.prevent_last_company_owner_delete();

-- Separate construction-rate deletion from ordinary rate maintenance.
drop policy if exists "estimators manage construction rates" on public.construction_rates;
create policy "estimators insert construction rates" on public.construction_rates for insert to authenticated
with check (public.has_company_role(company_id,array['owner','admin','tender_manager','estimator']) and created_by = (select auth.uid()));
create policy "estimators update construction rates" on public.construction_rates for update to authenticated
using (public.has_company_role(company_id,array['owner','admin','tender_manager','estimator']))
with check (public.has_company_role(company_id,array['owner','admin','tender_manager','estimator']));
create policy "admins delete construction rates" on public.construction_rates for delete to authenticated
using (public.has_company_role(company_id,array['owner','admin']));
