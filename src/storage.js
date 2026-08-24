import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && anon ? createClient(url, anon) : null;

// Shared data (households) lives in Supabase.
// Personal solo data stays on-device in localStorage.
const isShared = (key) => key.startsWith("hh:") || key === "simmer-community-recipes";

export async function loadKey(key, fallback, _shared = false) {
  try {
    if (isShared(key)) {
      if (!supabase) return fallback;
      const { data, error } = await supabase.from("kv").select("v").eq("k", key).maybeSingle();
      if (error || !data) return fallback;
      return data.v;
    }
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export async function saveKey(key, value, _shared = false) {
  try {
    if (isShared(key)) {
      if (!supabase) return;
      await supabase.from("kv").upsert({ k: key, v: value, updated_at: new Date().toISOString() });
      return;
    }
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("save failed", e);
  }
}

export async function keyExists(key, _shared = false) {
  try {
    if (isShared(key)) {
      if (!supabase) return false;
      const { data, error } = await supabase.from("kv").select("k").eq("k", key).maybeSingle();
      return !error && !!data;
    }
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}
