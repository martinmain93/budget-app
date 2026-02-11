# Information Security Policy -- Basic Budget

Last updated: February 2026

## 1. Encryption Architecture

All sensitive user data is encrypted client-side before leaving the browser.

- **Key derivation:** PBKDF2 with 310,000 iterations, SHA-256, producing a 256-bit AES-GCM wrapping key
- **Vault data key:** A random 256-bit AES-GCM key is generated per vault and wrapped (encrypted) with the PBKDF2-derived key
- **Payload encryption:** All transactions, categories, budgets, rules, bank metadata, and family member data are encrypted with AES-256-GCM using the vault data key
- **Key inputs:** For Google Auth users: `PBKDF2(googleSubjectId + 6-digit PIN)`. For password users: `PBKDF2(password)`
- **Server-side storage:** Only encrypted blobs are stored. Administrators and database operators cannot read user financial data
- **Implementation:** Web Crypto API (`crypto.subtle`) -- no custom cryptographic implementations

## 2. Authentication and Multi-Factor Authentication (MFA)

The application implements multi-factor authentication:

- **Factor 1 (Identity):** Google OAuth 2.0 via Supabase Auth, or email/password
- **Factor 2 (Knowledge):** 6-digit vault PIN (Google users) or vault password (password users)
- Both factors are required to derive the encryption key and access any data
- Neither factor alone is sufficient to decrypt the vault
- **Brute-force protection:** After 3 failed unlock attempts, exponential backoff is enforced (2s, 4s, 8s... up to 5 minutes)

## 3. Access Control Policy

### Application-level controls
- **Row Level Security (RLS):** Supabase PostgreSQL RLS policies ensure each authenticated user can only SELECT, INSERT, UPDATE, or DELETE their own `vault_data` row
- **Client-side encryption:** Even if RLS were bypassed, data is encrypted and unreadable without the user's credentials
- **Role-based access:** Family members have roles (`owner` or `member`). Only vault owners can delete the vault or invite new members

### Infrastructure access
- **Supabase:** Accessed via publishable API key (safe for browsers). Secret/service keys are never exposed client-side
- **Cloudflare Pages:** Static hosting with no server-side code execution. Secrets are stored in GitHub Actions secrets
- **GitHub:** Repository access is controlled by the repository owner

## 4. Centralized Identity and Access Management

- **Identity provider:** Supabase Auth serves as the centralized IAM
- **OAuth provider:** Google OAuth 2.0 for identity federation
- **Session management:** Supabase handles session tokens, automatic refresh, and expiry
- **Single sign-out:** Signing out clears both Supabase session and local vault data

## 5. Vulnerability Scanning

- **Automated scanning:** GitHub Actions workflow runs `npm audit` on every push and weekly (Monday 8am UTC)
- **Dependency updates:** Dependabot is configured to open PRs for npm and GitHub Actions dependency updates weekly
- **Build verification:** Every push triggers a full TypeScript type-check and production build

### Remediation SLA
| Severity | Remediation deadline |
|----------|---------------------|
| Critical | 7 days |
| High     | 30 days |
| Medium   | 90 days |
| Low      | Next scheduled update cycle |

## 6. Patch Management and EOL Monitoring

- **Dependabot:** Automatically detects outdated and vulnerable dependencies and opens PRs
- **Node.js version:** Pinned in CI (Node 20 LTS). Will be updated when new LTS versions are released
- **EOL monitoring:** Dependencies are reviewed during quarterly access reviews. End-of-life packages are replaced or removed
- **Update cadence:** Minor and patch updates are grouped and applied weekly. Major updates are reviewed manually

## 7. Data Deletion and Retention

### Retention
- Encrypted vault data is retained in Supabase until the user explicitly deletes their account
- No plaintext financial data is ever stored server-side
- Authentication metadata (email, name) is stored by Supabase Auth until account deletion
- Browser localStorage stores an encrypted copy of the vault for offline access

### Deletion
- Users can delete their account from the app dashboard ("Delete account" button)
- Account deletion permanently removes:
  - The `vault_data` row from Supabase (encrypted envelope, shards, and metadata)
  - The Supabase Auth session
  - All localStorage data in the browser
- Deletion is immediate and irreversible

## 8. De-provisioning and Access Revocation

- **User account deletion:** Removes all data from Supabase and localStorage immediately
- **Family member removal:** Vault owners can remove family members via the dashboard. Removed members lose access on their next session
- **Session revocation:** Signing out invalidates the Supabase session token and clears local credentials
- **Google OAuth revocation:** Users can revoke app access from their Google Account settings

## 9. Consent Management

- **Bank account connections:** Users are shown an explicit consent dialog before connecting any bank account. The dialog explains what data will be collected and how it will be processed
- **Consent logging:** Each consent action is timestamped and stored (encrypted) in the user's vault metadata
- **Withdrawal:** Users can disconnect bank accounts and delete their account at any time
- **Privacy policy:** Available at `/privacy` (linked from all authentication screens)

## 10. Secure Tokens and Certificates

- **HTTPS:** All traffic is served over HTTPS via Cloudflare with HSTS (max-age 2 years, includeSubDomains, preload)
- **OAuth tokens:** Google OAuth 2.0 tokens are managed by Supabase Auth with automatic refresh
- **API keys:** Supabase publishable keys are used client-side (safe by design). Secret keys are never exposed
- **AI API keys:** Stored encrypted in the user's vault. Sent directly to the AI provider over HTTPS
- **CSP:** Content Security Policy restricts script sources, connection targets, and frame ancestors

## 11. Security Headers

The following headers are set on all responses via Cloudflare Pages:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.plaid.com; ...`

## 12. Periodic Access Reviews

Reviews are conducted quarterly and include:
- [ ] Verify Supabase RLS policies are enabled and correct
- [ ] Review Supabase Auth user list for inactive or suspicious accounts
- [ ] Audit GitHub repository collaborator access
- [ ] Review and update dependencies (check Dependabot PRs)
- [ ] Verify security scanning workflow is running and passing
- [ ] Check Node.js and dependency EOL status
- [ ] Review Cloudflare Pages access and API tokens
- [ ] Verify Plaid application security settings (if applicable)

## 13. Incident Response

In the event of a security incident:
1. **Identify:** Determine the scope and nature of the incident
2. **Contain:** Revoke compromised credentials, rotate API keys if needed
3. **Notify:** If user data may be affected, notify impacted users
4. **Remediate:** Fix the vulnerability, deploy patches
5. **Review:** Conduct post-incident review and update policies

## 14. Contact

For security concerns or vulnerability reports, please contact the project maintainer via the project's GitHub repository.
