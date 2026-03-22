import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/server/auth";
import { getSupabaseAdmin, STORAGE_BUCKET, getPublicUrl } from "@/server/supabase";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = [
  // Images
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv",
  // Audio
  "audio/mpeg", "audio/wav", "audio/ogg", "audio/webm", "audio/mp4",
  // Video
  "video/mp4", "video/webm",
  // Archives
  "application/zip", "application/gzip",
];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: `File type not allowed: ${file.type}` }, { status: 400 });
  }

  // Generate unique path: userId/timestamp-filename
  const safeName = file.name
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .slice(0, 100);
  const filePath = `${session.user.id}/${Date.now()}-${safeName}`;

  const supabase = getSupabaseAdmin();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error("[Upload] Supabase error:", error.message);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const publicUrl = getPublicUrl(filePath);

  // Determine message type from MIME
  let type: "image" | "file" | "audio" = "file";
  if (file.type.startsWith("image/")) type = "image";
  else if (file.type.startsWith("audio/")) type = "audio";

  return NextResponse.json({
    url: publicUrl,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    type,
  });
}
