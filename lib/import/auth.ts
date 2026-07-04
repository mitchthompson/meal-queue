// Verifies the caller's Supabase access token server-side. Does NOT import
// lib/supabase/client.ts (that client is browser-oriented and throws at import
// if env is missing). The NEXT_PUBLIC_* vars are readable server-side, so no new
// Supabase env is introduced.
import { createClient } from "@supabase/supabase-js";
import { importError } from "./errors";

export async function verifyUser(req: Request): Promise<string> {
  const authHeader = req.headers.get("authorization"); // Headers.get is case-insensitive
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;
  if (!token) throw importError("unauthorized");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw importError("unauthorized");

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) throw importError("unauthorized");
  return data.user.id;
}
