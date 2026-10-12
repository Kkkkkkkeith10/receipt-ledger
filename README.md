# receipt-ledger

A small bookkeeping app for a sole proprietor or small company: photograph a receipt, let an AI model read it, check the result, and keep a ledger and year-end reports ready for an accountant.

**Started:** 31 Aug 2025


Built with SvelteKit and TypeScript on Cloudflare Workers (D1 for data, R2 for receipt files), installable as a PWA.

## Features

- Receipt capture from camera or file, with AI extraction (vendor, date, amount, tax) via Azure OpenAI
- Review and approval of extracted receipts; duplicate detection
- Chart of accounts and categories, transactions, and financial-year reports with CSV/PDF export
- Hong Kong financial year (April to March) by default; see `docs/HK_COMPLIANCE.md` for the notes behind it
- Email/password login (Auth.js with a D1 adapter)

## Quick start

```bash
pnpm install
cp .dev.vars.example .dev.vars        # fill in AUTH_SECRET and the Azure OpenAI values
wrangler d1 create accounting-db      # put the returned id into wrangler.toml (YOUR_D1_DATABASE_ID)
wrangler r2 bucket create accounting-receipts
wrangler r2 bucket create accounting-receipts-preview
pnpm run db:migrate
wrangler d1 execute accounting-db --local --file=data/sample-receipts.sql   # synthetic sample receipts
SEED_USER_PASSWORD=... npx tsx scripts/seed-users.ts   # prints SQL for demo users (password from the env)
pnpm run dev
```

More detail: `SETUP.md`, `DEPLOYMENT.md`, `CHECKLIST.md`.

## Sample data

Everything under `data/` and `tests/fixtures/` is synthetic. No real receipts are included.


## Progress log

This public repo is a cleaned snapshot. The full development history stays private.

### August 2025

- 31 Aug: Planned the app and built the first version: dashboard, receipt management, navigation and setup docs.

### January 2026

- 6 Jan: Moved storage to Cloudflare D1 and R2.
- 8 Jan: AI receipt reading, upload tests and the Cloudflare build.
- 8 Jan: Sign-in, settings and transactions pages, archived receipts, a document viewer, quick upload and PWA support.
- 10 Jan: Multi-currency receipts.

### May 2026

- 7 May: A non-blocking upload queue with duplicate detection (with unit tests) and a fiscal-year filter.
- 7 May: An editable approval page with a duplicate scan and side-by-side compare; flags for suspicious receipts.
- 8 May: Bulk receipt actions and better PDF uploads.
- 8 May: Reports fixes: amounts in HKD, approved receipts only, and a full financial CSV export.

## Licence

MIT. See `LICENSE`.
