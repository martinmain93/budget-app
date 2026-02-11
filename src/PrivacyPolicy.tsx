export function PrivacyPolicy({ onBack }: { onBack: () => void }) {
  return (
    <div className="shell" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="card" style={{ lineHeight: 1.7 }}>
        <button type="button" className="ghost" onClick={onBack} style={{ marginBottom: "1rem" }}>&larr; Back</button>
        <h1>Privacy Policy</h1>
        <p><em>Last updated: February 2026</em></p>

        <h2>1. What we collect</h2>
        <p>Basic Budget is designed around a zero-trust, privacy-first architecture. We collect the minimum data necessary to operate:</p>
        <ul>
          <li><strong>Authentication data:</strong> When you sign in with Google, Supabase Auth stores your email, name, and Google subject ID. This is used solely for authentication.</li>
          <li><strong>Encrypted vault data:</strong> Your financial data (transactions, categories, budgets, bank account metadata, family members) is encrypted client-side using AES-256-GCM before being stored. The encryption key is derived from your credentials using PBKDF2 with 310,000 iterations. We cannot read your financial data.</li>
          <li><strong>Bank account connections:</strong> If you connect a bank account via Plaid, Plaid processes your bank credentials directly. We receive only transaction data (merchant, amount, date) which is immediately encrypted in your browser before storage.</li>
        </ul>

        <h2>2. How your data is protected</h2>
        <ul>
          <li>All data is encrypted in your browser before it leaves your device</li>
          <li>Encryption uses AES-256-GCM with PBKDF2-derived keys (310,000 iterations)</li>
          <li>Server-side storage contains only encrypted blobs -- administrators cannot read your data</li>
          <li>Authentication requires both your Google account and a 6-digit PIN (multi-factor)</li>
          <li>All connections use HTTPS with HSTS preloading</li>
          <li>Row Level Security ensures each user can only access their own encrypted data</li>
        </ul>

        <h2>3. Third-party services</h2>
        <ul>
          <li><strong>Supabase:</strong> Hosts authentication and encrypted vault storage. <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">Supabase Privacy Policy</a></li>
          <li><strong>Google OAuth:</strong> Used for authentication only. <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a></li>
          <li><strong>Plaid:</strong> Used for bank account connections (when configured). Plaid processes bank credentials directly and is subject to their own privacy policy. <a href="https://plaid.com/legal/#end-user-privacy-policy" target="_blank" rel="noopener noreferrer">Plaid Privacy Policy</a></li>
          <li><strong>Cloudflare:</strong> Hosts the application and provides CDN/security. <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflare Privacy Policy</a></li>
          <li><strong>AI providers (optional):</strong> If you configure AI categorization, your API key is stored encrypted in your vault. Transaction merchant names may be sent to the AI provider you choose. No financial amounts or personal data are sent.</li>
        </ul>

        <h2>4. Data retention and deletion</h2>
        <ul>
          <li>Your encrypted vault data is retained until you explicitly delete it</li>
          <li>No plaintext financial data is ever stored on our servers</li>
          <li>You can delete your account and all associated data at any time from the app settings</li>
          <li>Upon account deletion, all encrypted vault data is permanently removed from our servers and your browser</li>
          <li>Authentication records in Supabase Auth are removed upon account deletion</li>
        </ul>

        <h2>5. Consent</h2>
        <p>By using Basic Budget, you consent to the collection and processing of data as described in this policy. Before connecting a bank account, you will be asked for explicit consent. You may withdraw consent at any time by deleting your account.</p>

        <h2>6. Your rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access all your data (it is stored locally in your browser and can be exported)</li>
          <li>Delete your account and all associated data</li>
          <li>Withdraw consent for bank account connections</li>
          <li>Request information about how your data is processed</li>
        </ul>

        <h2>7. Cookies and tracking</h2>
        <p>Basic Budget does not use tracking cookies, analytics, or advertising. The only storage used is browser localStorage for your encrypted vault and Supabase session tokens for authentication.</p>

        <h2>8. Changes to this policy</h2>
        <p>We may update this privacy policy from time to time. Changes will be reflected in the "Last updated" date above.</p>

        <h2>9. Contact</h2>
        <p>For privacy-related questions, please contact the project maintainer via the project's GitHub repository.</p>
      </div>
    </div>
  );
}
