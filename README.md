# TenderGenie AI™

Africa's Tender Intelligence & Procurement Network for construction tender teams and quantity surveyors.

## Current workflow foundation

- **Authentication:** Supabase Auth email/password sign-up and sign-in.
- **Company profile:** company registration, tax, CIDB, CSD, province and service categories.
- **Private document vault:** private Supabase Storage bucket, company-path policies, upload limits and short-lived signed downloads.
- **PDF extraction:** user-triggered server-side OpenAI extraction endpoint; extracted fields remain marked `needs_review` and must be checked against the source PDF.
- **Tender Radar:** manual opportunity register, closing/clarification deadlines, lifecycle status, preliminary category/province fit indicators and event audit trail.
- **Compliance:** human-reviewed pass/fail/review criteria linked to stored evidence.
- **Construction rate library:** store ZAR rates with source references, validity dates, supporting documents and assumptions.
- **QS estimator:** editable component rates and quantities, persistent BOQ projects, calculated line amounts, source notes and variance flags against exact matching composite rates. User-entered rates are assumptions, not verified market prices.
- **Proposal controls:** draft versions, internal review, manager approval/locking and manual submission/receipt tracking.

## Architecture

Next.js 16 App Router, TypeScript, Supabase Auth/Postgres/Storage and server-side OpenAI API calls. No service-role key is required by the current browser workflows. The OpenAI key is server-only.

## Configure locally / deploy

1. Install dependencies with `npm install`.
2. Copy `.env.example` to your deployment environment and set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `OPENAI_API_KEY` for PDF extraction
   - optionally `OPENAI_DOCUMENT_MODEL`
3. Configure Supabase Auth email confirmation and allowed redirect URLs for your deployed domain.
4. Review and apply `supabase/migrations/202610240001_secure_tender_workflows.sql` in a **non-production** Supabase project first.
5. Run `supabase test db` for the schema smoke tests after the migration is applied.
6. Run `npm run build` and complete the manual acceptance checks below before production deployment.

Never commit API keys, service-role credentials, passwords, real company documents or production data.

## Manual acceptance checks required

- Sign up, confirm email, sign in, sign out/session expiry and role boundaries.
- Verify one company cannot read another company's records or private files.
- Upload valid and invalid file types, verify the 25 MB limit, signed-download expiry and access after membership removal.
- Extract a sample PDF and confirm every returned field stays in `needs_review` until a person checks the source.
- Verify tender deadlines, category/province indicators, status transitions and append-only event records.
- Save a BOQ and confirm each line has an estimator-assumption source note and calculated amount.
- Verify only authorized managers can approve/lock proposals or approve submissions; record a submission receipt without transmitting automatically.
- Run an end-to-end browser test on the deployed URL with production-like configuration.

## Known limitations

- Tender opportunities are entered manually. Public tender-source connectors, licensed data ingestion, automatic deadline alerts and live eligibility rules are not yet configured.
- PDF extraction is user-triggered and currently supports PDF files only. It does not itself establish compliance or submit bids.
- The proposal screen stores draft text and governance states; production-ready proposal document generation, signed final-file hashes and buyer-channel submission integrations remain future work.
- A successful Next.js build validates compilation and types, not the database migration, RLS isolation, AI API configuration or live deployment.
