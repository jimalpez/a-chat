import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Server-side Supabase client with service role key.
 * Bypasses RLS — only use on the server.
 */
export function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase URL and service role key are required for file uploads");
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

export const STORAGE_BUCKET = "chat-files";

/**
 * Get the public URL for a file in the storage bucket.
 */
export function getPublicUrl(filePath: string): string {
  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  return `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${filePath}`;
}
