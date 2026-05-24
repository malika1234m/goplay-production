import { NextRequest } from "next/server";
import { getSession } from "@/lib/mobile-auth";
import { cloudinary, isConfigured } from "@/lib/cloudinary";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILES     = 8;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];

function uploadToCloudinary(buffer: Buffer, mimetype: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder:         "goplay/grounds",
        resource_type:  "image",
        transformation: [{ quality: "auto", fetch_format: "auto" }],
      },
      (err, result) => {
        if (err || !result) return reject(err ?? new Error("Upload failed"));
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.user || !["GROUND_OWNER", "ADMIN"].includes(session.user.role ?? "")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!isConfigured()) {
      return Response.json({ error: "Image upload is not configured on this server." }, { status: 503 });
    }

    const formData = await req.formData();
    const files    = formData.getAll("images") as File[];

    if (!files.length)           return Response.json({ error: "No images provided." }, { status: 400 });
    if (files.length > MAX_FILES) return Response.json({ error: `Max ${MAX_FILES} images allowed.` }, { status: 400 });

    // Validate all files before uploading any
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return Response.json(
          { error: `"${file.name}" is not a supported image type. Use JPEG, PNG, or WebP.` },
          { status: 400 }
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        return Response.json(
          { error: `"${file.name}" exceeds the 5 MB limit.` },
          { status: 400 }
        );
      }
    }

    // Upload all files in parallel
    const urls = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        return uploadToCloudinary(buffer, file.type);
      })
    );

    return Response.json({ urls });
  } catch (err) {
    console.error("[POST /api/upload/ground-images]", err);
    return Response.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
