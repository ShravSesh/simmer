import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anon ? createClient(url, anon) : null;

// Whether this build can talk to Supabase at all. When false, every shared
// read/write throws instead of pretending to succeed — a household created
// against a null client looks fine on screen and stores nothing.
export const syncConfigured = !!supabase;

const NOT_CONFIGURED =
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
