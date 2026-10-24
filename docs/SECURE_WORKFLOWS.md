# Secure workflow foundation

This branch introduces the first database foundation for TenderGenie's production workflows.

## Included
- Company profiles and membership roles with row-level security.
- Tenant-scoped tenders, eligibility checks, document metadata and a private Storage bucket.
- Rate-source provenance and construction rates in ZAR.
- BOQ projects and line items with calculated amounts; assumptions and manual overrides require notes.
- Proposal versions, submission approval gates and tender event history.

## Workflow rules
1. Store deadlines as timezone-aware timestamps and display them in the user's configured timezone.
2. Treat extraction as assistive: machine-extracted fields must be reviewed before satisfying mandatory compliance criteria.
3. Every BOQ rate must point to a rate source or be marked as an assumption/manual override with a written note. Never silently fabricate market rates.
4. Never auto-submit when a proposal is generated. Require a named approver, explicit approval, a locked final document/hash, user-triggered submission and receipt evidence.
5. Append lifecycle transitions to tender_events; preserve the audit trail.
6. Keep files in the private tender-documents bucket under <company-uuid>/<opaque-file-key>. Issue short-lived signed URLs only after server-side authorization.

## Apply and validate
- Apply all timestamped SQL migrations in `supabase/migrations` in order, first in a non-production Supabase project.
- Enable `pgtap` in the test project before running `supabase test db`; run database security/performance advisors after migration.
- Configure Auth redirect URLs and email delivery; never commit service-role secrets.
- Add RLS tests for cross-company access, private Storage, role boundaries, submission approval and audit immutability.
- Run end-to-end tests covering registration, company creation, file upload, extraction review, eligibility, rates/BOQ, proposal approval, submission receipt and lifecycle close-out.

## Current limitations
This migration is a data/security foundation, not a claim that every UI/API workflow is complete or deployed. Test against the target Supabase project before production. Confirm tender-source licensing and terms before ingestion. This schema does not submit tenders automatically.
