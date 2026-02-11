import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export interface GoogleUser {
  id: string;          // Supabase auth uid
  email: string;
  displayName: string;
  googleSub: string;   // Google's stable subject identifier
}

/** Kick off the Google OAuth redirect via Supabase Auth. */
export async function signInWithGoogle(): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) throw error;
}

/** Get the current Supabase session (null if not logged in). */
export async function getSupabaseSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Extract a GoogleUser from a Supabase User object. */
export function toGoogleUser(user: User): GoogleUser {
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? meta.email ?? "",
    displayName: meta.full_name ?? meta.name ?? user.email?.split("@")[0] ?? "",
    googleSub: meta.sub ?? meta.provider_id ?? user.id,
  };
}

/** Listen for auth state changes (login, logout, token refresh). */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): { unsubscribe: () => void } {
  if (!supabase) return { unsubscribe: () => {} };
  const { data } = supabase.auth.onAuthStateChange(callback);
  return { unsubscribe: () => data.subscription.unsubscribe() };
}

/** Sign out of Supabase Auth. */
export async function signOutSupabase(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}
