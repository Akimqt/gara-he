import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // Loud on purpose — every read/write in pos-store.ts silently no-ops
  // (or throws) without these, which is a confusing way to discover it.
  console.error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project's values.",
  );
}

export const supabase = createClient(url ?? "", anonKey ?? "", {
  auth: { persistSession: false },
});
