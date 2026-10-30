import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.SUPABASE_URL || "http://localhost",
  process.env.SUPABASE_SERVICE_KEY || "missing"
);

export const BUCKET = process.env.SUPABASE_BUCKET || "evidence";

export async function uploadEvidence(buffer, mimeType, id) {
  const ext = (mimeType || "image/jpeg").split("/")[1] || "jpg";
  const path = `${id}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: true });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
