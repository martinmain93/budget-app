# Plaid Edge Functions

Implement these endpoints and point `VITE_API_BASE_URL` at your deployed function base URL:

- `POST /plaid/link-token`
- `POST /plaid/exchange-token`
- `POST /plaid/sync-transactions`

Important:

- Keep Plaid secrets server-side only.
- Return only the minimum data needed by the browser.
- Never decrypt or inspect user vault shards server-side.
- Persist only encrypted payloads and metadata indexes.
