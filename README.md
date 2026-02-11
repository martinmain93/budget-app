# Budget Vault App

Zero-trust budgeting app MVP built with React + TypeScript + Vite.

## What is implemented

- Responsive, flat/minimal pastel UI with chart-driven dashboard.
- Vault-first architecture: transactions are encrypted client-side and only decrypted in-browser.
- Vault shard strategy by month (`YYYY-MM`) for easier syncing and lower decrypt cost.
- Plaid integration hooks (link token, token exchange, transaction sync) with offline mock fallback.
- Multiple bank accounts support.
- Family linking metadata flow.
- Prebuilt + custom categories.
- AI-style auto-categorization, user corrections, and rule suggestions from user behavior.
- Click-down detail analytics: category pie drill-down + 6-month bar trend.
- Budget editor with hover-reveal controls and monthly budget progress bars.
- Auto-sync on unlock/open.

## Quick start

```bash
npm install
npm run dev
```

## Environment variables

Create `.env`:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_API_BASE_URL=http://localhost:54321/functions/v1
```

`VITE_API_BASE_URL` is used for server endpoints that interact with Plaid.  
When missing, the app uses local mock data so UI and encrypted flows still work.

## Data security model

- Password never leaves the browser.
- Browser derives a wrapping key via PBKDF2.
- A random 256-bit vault data key is generated and wrapped (encrypted) by the wrapping key.
- Transaction payloads are encrypted with AES-GCM using the vault data key.
- Ciphertext is stored in month shards; metadata is stored separately.
- Developers/admins only see encrypted blobs and high-level counts.

## Recommended next production steps

- Add authenticated Supabase user flow and RLS for every table.
- Implement Plaid server functions (`/plaid/link-token`, `/plaid/exchange-token`, `/plaid/sync-transactions`).
- Add family sharing with per-member key envelopes (public-key wrapped data keys).
- Add background sync scheduler and retry queue.
- Add cryptographic audit logging and key-rotation flows.
