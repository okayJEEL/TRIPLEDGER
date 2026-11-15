# TripLedger — Maharashtra Western Ghats Study Tour

**TripLedger** is a production financial management web application built with **React, TypeScript, Tailwind CSS, Recharts, and Supabase** for the **Maharashtra Western Ghats Study Tour** (`3 December 2026 – 12 December 2026`).

## Core Capabilities

- **Role-Based Authentication (Supabase Auth + PostgreSQL RLS)**:
  - **Main Admin (`admin`)**: Full access to participants, income, expenses, receipts, budget settings, reports, exports, and immutable audit logs.
  - **Faculty Viewer (`faculty_viewer`)**: Strictly read-only access enforced at both UI and PostgreSQL/Storage RLS levels.
  - Password recovery and password change flows via Supabase Auth.
- **Real-Time Multi-Device Synchronisation**:
  - Live `postgres_changes` WebSocket channel across `participants`, `income_transactions`, `expense_transactions`, and `budget_settings`.
  - Automatic reconnection handling, online/offline detection, and last-synced timestamp.
- **Accurate Derived Accounting**:
  - `Expected Collection` = Sum of active participants' budgets.
  - `Total Collected` = Sum of actual `income_transactions`.
  - `Pending Collection` = `Expected Collection − Total Collected`.
  - `Available Balance` = `Total Collected − Total Expenses`.
- **Participant Roster**:
  - Auto-generated codes (`STU001`, `FAC001`), search, payment status filters, payment history, and CSV/Excel bulk import.
- **Private Receipt & Document Vault**:
  - Private Supabase Storage bucket (`trip-receipts`) supporting JPG, JPEG, PNG, and PDF (up to 10 MB) via time-limited signed URLs.
- **Reports & Exports**:
  - Overall, Participant, Category, and Daily reports exported cleanly to **Excel (`.xlsx`)**, **CSV (`.csv`)**, and **PDF (`.pdf`)**.

## Environment Variables

Configure `.env` (see `.env.example`):

```env
VITE_SUPABASE_URL=https://iapqnpznadwsohjqbegu.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
```

> Never place `service_role` or secret keys in frontend code or `.env`.

## Local Development

```bash
npm install
npm run dev
```

## Production Build & Free Hosting (Vercel / Netlify)

```bash
npm run build
```

1. Push the repository to GitHub or deploy directly with Vercel / Netlify.
2. Set build command to `npm run build` and output directory to `dist`.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the hosting provider's Environment Variables settings.
4. Configure SPA rewrite (`/* -> /index.html`) so `/reset-password` resolves properly.
5. In Supabase **Authentication -> URL Configuration**, add your deployed domain to **Site URL** and **Redirect URLs** (`https://your-domain.vercel.app/reset-password`).

See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for exact database migration and account provisioning steps.
