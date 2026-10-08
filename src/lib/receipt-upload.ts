import { cloudinary, isConfigured } from "@/lib/cloudinary";
import { checkReceipt } from "@/lib/receipt-check";

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB

/** Reads the "receipt" file from a multipart request and stores it. Returns the URL or a user-facing error. */
export async function uploadReceiptFromForm(formData: FormData): Promise<{ url: string } | { error: string; status: number }> {
  if (!isConfigured()) return { error: "Receipt upload is not configured on this server.", status: 503 };

  const file = formData.get("receipt");
  if (!(file instanceof File) || file.size === 0) return { error: "Please attach a photo or PDF of your receipt.", status: 400 };
  if (file.size > MAX_FILE_SIZE) return { error: "The receipt must be under 8 MB.", status: 400 };

  // Judge the file by its contents, not the browser-supplied type or name
  const buffer = Buffer.from(await file.arrayBuffer());
  const checked = await checkReceipt(buffer);
  if ("error" in checked) return { error: checked.error, status: 400 };
  const url = await new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "goplay/receipts", resource_type: checked.kind === "pdf" ? "raw" : "image" },
      (err, result) => {
        if (err || !result) return reject(err ?? new Error("Upload failed"));
        resolve(result.secure_url);
      },
    );
    stream.end(buffer);
  });
  return { url };
}
