# ExpenseTracker

Personal expense tracker for a handful of people, each on their own account.
Snap a photo of a receipt and Gemini reads the shop, date and every line,
assigns each line a category and splits the receipt into one expense per
category - you review and fix anything before it is saved.

**Stack:** Next.js 16 (App Router, Server Actions) · React 19 · Tailwind v4 ·
Firestore · Cloud Storage · Gemini on Vertex AI · Cloud Run · Terraform ·
GitHub Actions + Cloud Build (Workload Identity Federation, no keys).

## Features

- **Receipt scanning** - photo is scaled down in the browser, stored in a
  private bucket, read by Gemini with a strict JSON schema (the model can only
  answer with your own category IDs), validated again on the server. Discounts
  are folded into product prices, a line sum that does not match the total is
  flagged. Save as one expense or split by category.
- **Per-product statistics** - every receipt line also gets a generic product
  name, quantity with a unit (kg from the weighing or the pack size, litres,
  pieces) and a product group. The model is given the user's existing product
  names, so "MARCHEW LUZ" in one shop and "Marchewka myta 1kg" in another both
  become "marchew". See how many kilograms of fruit you bought this month, the
  price per kg of chicken breast over time and which shop sells it cheapest.
- **AI category suggestions** for expenses typed by hand - the merchant memory
  answers first (whatever you chose for "Rossmann" last time), Gemini only
  when the merchant is new.
- **Dashboard** - month total vs the same period last month, daily average,
  month-end projection, daily chart, category ring, top merchants.
- **Budgets per category** with a warning *before* you overspend: the bar
  shows where the month will end at the current pace.
- **Recurring expenses** (subscriptions, rent) booked automatically on their
  date, with idempotent IDs so nothing is booked twice.
- **Foreign currencies** converted with the official NBP (National Bank of
  Poland) rate for the expense date, cached forever.
- **Reports** - 12-month trend, category x month heatmap, spending by weekday,
  biggest expenses; CSV export (Polish Excel friendly, formula-injection safe).
- Search across merchants, notes, tags and receipt lines; filters; tags.
- Installable on a phone (web app manifest with a "scan receipt" shortcut),
  light and dark theme.
- **Accounts** created only by an admin: scrypt password hashes, signed
  session cookies revoked on password change, rate-limited login with
  constant-time checks, per-user data isolated by Firestore path.

## Architecture

```
Browser ── Cloud Run (Next.js, service account web-app@)
              ├─ Firestore (default, eur3)   users/{uid}/{expenses,categories,recurring,merchants}
              ├─ Cloud Storage (private)     receipts/{uid}/YYYY-MM/<uuid>.jpg
              ├─ Vertex AI Gemini (global)   receipt reading, category suggestions
              ├─ Secret Manager              session signing key
              └─ NBP API                     exchange rates
```

Everything is in `terraform/`: APIs, Firestore (production + a separate
`development` database for local work, daily backups), buckets with lifecycle
rules, Cloud Run, least-privilege service accounts, Artifact Registry with a
cleanup policy, GitHub OIDC, uptime check with e-mail alerts and a monthly
cost budget.

## Local development

```bash
gcloud auth application-default login
cp .env.example .env.local   # fill SESSION_SECRET with: openssl rand -hex 32
npm install
npm run create-user -- --email you@example.com --name You --role admin --database development
npm run dev
```

Checks: `npm run lint && npm test && npm run build`.
End-to-end in headless Chrome against a running app:
`EMAIL=... PASSWORD=... node scripts/browser-test.mjs http://localhost:3000 /tmp/shots receipt.jpg`.

## Infrastructure from scratch

```bash
gcloud projects create <id> && gcloud billing projects link <id> --billing-account <account>
gcloud services enable cloudresourcemanager.googleapis.com iam.googleapis.com --project <id>
gcloud storage buckets create gs://<id>-tfstate --location europe-west1
cd terraform && terraform init
terraform apply -target=google_secret_manager_secret_iam_member.app_reads_session   # secret container first
openssl rand -base64 48 | gcloud secrets versions add session-secret --data-file=-
terraform apply
npm run create-user -- --email you@example.com --name You --role admin   # first admin in production
```

Pushing to `main` runs lint, tests and build, then Cloud Build builds the
image and deploys it to Cloud Run.
