import { useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "./supabaseClient";

const MIN_PASSWORD_LENGTH = 10;
const PIN_LENGTH = 6;

/* ── Shared types ─────────────────────────────────────── */

interface OnboardingValues { displayName: string; email: string; password: string }

interface OnboardingScreenProps {
  onboarding: OnboardingValues;
  onSubmit: (e: FormEvent) => Promise<void>;
  onChange: (next: OnboardingValues) => void;
  onGoogleSignIn: () => void;
  googleLoading?: boolean;
}

interface UnlockScreenProps {
  unlockPassword: string;
  unlockError: string | null;
  onSubmit: (e: FormEvent) => Promise<void>;
  onPasswordChange: (v: string) => void;
}

interface PinSetupScreenProps {
  googleEmail: string;
  onSubmit: (pin: string) => Promise<void>;
  error: string | null;
}

interface PinUnlockScreenProps {
  googleEmail: string;
  onSubmit: (pin: string) => Promise<void>;
  error: string | null;
  onSignOut: () => void;
}

/* ── Privacy link footer ──────────────────────────────── */

function PrivacyFooter() {
  return (
    <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
      <a href="#privacy" onClick={() => window.location.hash = "privacy"} style={{ fontSize: "0.78rem", color: "#8a99aa" }}>
        Privacy Policy
      </a>
    </div>
  );
}

/* ── Google divider ───────────────────────────────────── */

function Divider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "0.5rem 0" }}>
      <div style={{ flex: 1, height: 1, background: "#e0e6f0" }} />
      <small style={{ color: "#8a99aa" }}>or</small>
      <div style={{ flex: 1, height: 1, background: "#e0e6f0" }} />
    </div>
  );
}

/* ── Onboarding (Google + password fallback) ──────────── */

export function OnboardingScreen({ onboarding, onSubmit, onChange, onGoogleSignIn, googleLoading }: OnboardingScreenProps) {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (onboarding.password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Vault password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (/^(.)\1+$/.test(onboarding.password)) {
      setPasswordError("Password must not be a single repeated character.");
      return;
    }
    setPasswordError(null);
    await onSubmit(event);
  };

  return (
    <div className="shell onboarding-shell">
      <div className="card">
        <h1>Basic Budget</h1>
        <p>Simple setup. Private by default. Your data stays encrypted in your browser.</p>

        <div className="stack">
          {supabase ? (
            <button type="button" className="google-btn" onClick={onGoogleSignIn} disabled={googleLoading}>
              <svg viewBox="0 0 24 24" width="18" height="18" style={{ marginRight: 8 }}>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {googleLoading ? "Signing in..." : "Continue with Google"}
            </button>
          ) : null}

          {supabase && !showPasswordForm ? (
            <>
              <Divider />
              <button type="button" className="ghost" onClick={() => setShowPasswordForm(true)} style={{ fontSize: "0.82rem" }}>
                Use email + password instead
              </button>
            </>
          ) : null}

          {(!supabase || showPasswordForm) && (
            <>
              {supabase && <Divider />}
              <form onSubmit={handleSubmit} className="stack">
                <input required placeholder="Your name" autoComplete="name" value={onboarding.displayName}
                  onChange={(e) => onChange({ ...onboarding, displayName: e.target.value })} />
                <input type="email" required placeholder="Email" autoComplete="email" value={onboarding.email}
                  onChange={(e) => onChange({ ...onboarding, email: e.target.value })} />
                <input type="password" required minLength={MIN_PASSWORD_LENGTH}
                  placeholder={`Vault password (min ${MIN_PASSWORD_LENGTH} chars)`} autoComplete="new-password"
                  value={onboarding.password}
                  onChange={(e) => { onChange({ ...onboarding, password: e.target.value }); if (passwordError) setPasswordError(null); }} />
                {passwordError && <small className="error">{passwordError}</small>}
                <button type="submit" className="primary">Create Vault</button>
              </form>
            </>
          )}
        </div>
        <PrivacyFooter />
      </div>
    </div>
  );
}

/* ── PIN Setup (after first Google login) ─────────────── */

export function PinSetupScreen({ googleEmail, onSubmit, error }: PinSetupScreenProps) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (pin.length !== PIN_LENGTH || !/^\d+$/.test(pin)) {
      setLocalError(`PIN must be exactly ${PIN_LENGTH} digits.`);
      return;
    }
    if (pin !== confirm) {
      setLocalError("PINs do not match.");
      return;
    }
    setLocalError(null);
    await onSubmit(pin);
  };

  return (
    <div className="shell onboarding-shell">
      <div className="card">
        <h1>Set your vault PIN</h1>
        <p>Signed in as <strong>{googleEmail}</strong>. Choose a {PIN_LENGTH}-digit PIN to encrypt your data.</p>
        <form onSubmit={handleSubmit} className="stack">
          <input type="password" inputMode="numeric" maxLength={PIN_LENGTH} required placeholder={`${PIN_LENGTH}-digit PIN`}
            autoComplete="new-password" value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setLocalError(null); }} />
          <input type="password" inputMode="numeric" maxLength={PIN_LENGTH} required placeholder="Confirm PIN"
            autoComplete="new-password" value={confirm} onChange={(e) => { setConfirm(e.target.value.replace(/\D/g, "")); setLocalError(null); }} />
          {(localError || error) && <small className="error">{localError || error}</small>}
          <button type="submit" className="primary">Create Vault</button>
        </form>
        <PrivacyFooter />
      </div>
    </div>
  );
}

/* ── PIN Unlock (returning Google user) ───────────────── */

export function PinUnlockScreen({ googleEmail, onSubmit, error, onSignOut }: PinUnlockScreenProps) {
  const [pin, setPin] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit(pin);
  };

  return (
    <div className="shell onboarding-shell">
      <div className="card">
        <h1>Unlock your vault</h1>
        <p>Signed in as <strong>{googleEmail}</strong>. Enter your PIN to decrypt.</p>
        <form onSubmit={handleSubmit} className="stack">
          <input type="password" inputMode="numeric" maxLength={PIN_LENGTH} required placeholder={`${PIN_LENGTH}-digit PIN`}
            autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
          {error && <small className="error">{error}</small>}
          <button type="submit" className="primary">Unlock</button>
        </form>
        <button type="button" className="ghost" onClick={onSignOut} style={{ marginTop: "0.75rem", fontSize: "0.82rem", width: "100%" }}>
          Sign out
        </button>
        <PrivacyFooter />
      </div>
    </div>
  );
}

/* ── Password Unlock (legacy / fallback) ──────────────── */

export function UnlockScreen({ unlockPassword, unlockError, onSubmit, onPasswordChange }: UnlockScreenProps) {
  return (
    <div className="shell onboarding-shell">
      <div className="card">
        <h1>Unlock your vault</h1>
        <p>Only your browser can decrypt your data.</p>
        <form onSubmit={onSubmit} className="stack">
          <input type="password" required placeholder="Vault password" autoComplete="current-password"
            value={unlockPassword} onChange={(e) => onPasswordChange(e.target.value)} />
          <button type="submit" className="primary">Unlock</button>
          {unlockError && <small className="error">{unlockError}</small>}
        </form>
        <PrivacyFooter />
      </div>
    </div>
  );
}
