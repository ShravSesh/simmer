import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

// A legacy anon key is a JWT whose payload carries the project ref it was
// issued for. That makes a mistyped URL detectable offline: if the host's
// subdomain and the key's `ref` disagree, every request would go to a
// project that isn't ours (or, for a typo'd host, nowhere at all).
// Modern sb_publishable_ keys aren't JWTs — skip the check for those.
function refMismatch(u, key) {
  const host = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/.exec((u || "").trim());
  if (!host) return `VITE_SUPABASE_URL doesn't look like a Supabase project URL: ${u}`;
  const parts = (key || "").split(".");
  if (parts.length !== 3) return null; // not a JWT; nothing to cross-check
  let claimed;
  try {
    const pad = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    claimed = JSON.parse(atob(pad + "=".repeat((4 - (pad.length % 4)) % 4))).ref;
  } catch {
    return null; // unreadable payload isn't itself proof of a mismatch
  }
  if (!claimed || claimed === host[1]) return null;
  return (
    `VITE_SUPABASE_URL points at project "${host[1]}", but the anon key was ` +
    `issued for "${claimed}". One of them is mistyped — the key's project is ` +
    `the authoritative one.`
  );
}

export const configError = url && anon ? refMismatch(url, anon) : null;

export const supabase = url && anon && !configError ? createClient(url, anon) : null;

// Whether this build can talk to Supabase at all. When false, every shared
// read/write throws instead of pretending to succeed — a household created
// against a null client looks fine on screen and stores nothing.
export const syncConfigured = !!supabase;

const NOT_CONFIGURED =
  configError ||
  "Household sync isn't set up for this build. VITE_SUPABASE_URL and " +
  "VITE_SUPABASE_ANON_KEY need to be set in Vercel, then redeploy.";

export class SyncError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "SyncError";
    this.cause = cause;
  }
}

// Shared data (households) lives in Supabase.
// Personal solo data stays on-device in localStorage.
const isShared = (key) => key.startsWith("hh:") || key === "simmer-community-recipes";

// Returns the stored value, or `fallback` when the row genuinely does not
// exist yet. Throws SyncError if the server could not be reached — callers
// must be able to tell "empty pantry" from "we don't know your pantry".
export async function loadKey(key, fallback) {
  if (isShared(key)) {
    if (!supabase) throw new SyncError(NOT_CONFIGURED);
    const { data, error } = await supabase.from("kv").select("v").eq("k", key).maybeSingle();
    if (error) throw new SyncError(`Couldn't read household data: ${error.message}`, error);
    return data ? data.v : fallback;
  }
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback; // corrupt local JSON is recoverable; treat as unset
  }
}

export async function saveKey(key, value) {
  if (isShared(key)) {
    if (!supabase) throw new SyncError(NOT_CONFIGURED);
    const { error } = await supabase
      .from("kv")
      .upsert({ k: key, v: value, updated_at: new Date().toISOString() });
    if (error) throw new SyncError(`Couldn't save household data: ${error.message}`, error);
    return;
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    throw new SyncError("Couldn't save on this device (storage full?).", e);
  }
}

export async function keyExists(key) {
  if (isShared(key)) {
    if (!supabase) throw new SyncError(NOT_CONFIGURED);
    const { data, error } = await supabase.from("kv").select("k").eq("k", key).maybeSingle();
    if (error) throw new SyncError(`Couldn't reach household sync: ${error.message}`, error);
    return !!data;
  }
  return localStorage.getItem(key) !== null;
}
