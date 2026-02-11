import type { FormEvent } from "react";

interface OnboardingValues {
  displayName: string;
  email: string;
  password: string;
}

interface OnboardingScreenProps {
  onboarding: OnboardingValues;
  onSubmit: (event: FormEvent) => Promise<void>;
  onChange: (next: OnboardingValues) => void;
}

export function OnboardingScreen({
  onboarding,
  onSubmit,
  onChange,
}: OnboardingScreenProps) {
  return (
    <div className="shell onboarding-shell">
      <div className="card">
        <h1>Sunny Budget</h1>
        <p>Simple setup. Private by default. Your data stays encrypted in your browser.</p>
        <form onSubmit={onSubmit} className="stack">
          <input
            required
            placeholder="Your name"
            autoComplete="name"
            value={onboarding.displayName}
            onChange={(event) =>
              onChange({ ...onboarding, displayName: event.target.value })
            }
          />
          <input
            type="email"
            required
            placeholder="Email"
            autoComplete="email"
            value={onboarding.email}
            onChange={(event) => onChange({ ...onboarding, email: event.target.value })}
          />
          <input
            type="password"
            required
            placeholder="Vault password"
            autoComplete="new-password"
            value={onboarding.password}
            onChange={(event) => onChange({ ...onboarding, password: event.target.value })}
          />
          <button type="submit" className="primary">Create Vault</button>
        </form>
      </div>
    </div>
  );
}

interface UnlockScreenProps {
  unlockPassword: string;
  unlockError: string | null;
  onSubmit: (event: FormEvent) => Promise<void>;
  onPasswordChange: (value: string) => void;
}

export function UnlockScreen({
  unlockPassword,
  unlockError,
  onSubmit,
  onPasswordChange,
}: UnlockScreenProps) {
  return (
    <div className="shell onboarding-shell">
      <div className="card">
        <h1>Unlock your vault</h1>
        <p>Only your browser can decrypt your data.</p>
        <form onSubmit={onSubmit} className="stack">
          <input
            type="password"
            required
            placeholder="Vault password"
            autoComplete="current-password"
            value={unlockPassword}
            onChange={(event) => onPasswordChange(event.target.value)}
          />
          <button type="submit" className="primary">Unlock</button>
          {unlockError ? <small className="error">{unlockError}</small> : null}
        </form>
      </div>
    </div>
  );
}
