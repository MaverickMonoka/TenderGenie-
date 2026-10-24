begin;

-- Run after applying the secure workflow migration in a disposable Supabase test project.
-- Execute with: supabase test db
select plan(14);

select has_table('public', 'companies', 'company profiles table exists');
select has_table('public', 'company_members', 'company membership table exists');
select has_table('public', 'tenders', 'tender register table exists');
select has_table('public', 'documents', 'document metadata table exists');
select has_table('public', 'eligibility_checks', 'eligibility checks table exists');
select has_table('public', 'rate_sources', 'rate provenance table exists');
select has_table('public', 'construction_rates', 'construction rates table exists');
select has_table('public', 'boq_projects', 'BOQ projects table exists');
select has_table('public', 'boq_items', 'BOQ line items table exists');
select has_table('public', 'proposals', 'proposal version table exists');
select has_table('public', 'submissions', 'submission controls table exists');
select has_table('public', 'tender_events', 'tender event log table exists');
select has_function('public', 'is_company_member', array['uuid'], 'company membership helper exists');
select has_function('public', 'guard_submission_transition', array[], 'submission gate trigger function exists');

select * from finish();
rollback();
