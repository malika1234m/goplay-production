import sharp from "sharp";

export type ReceiptKind = "jpeg" | "png" | "webp" | "heic" | "pdf";

const MIN_SHORT_SIDE = 300;   // px — a readable phone screenshot or photo is far larger
const MAX_ASPECT     = 8;     // a long banking-app screenshot is ~1:5; anything thinner is not a receipt
const MAX_PDF_PAGES  = 5;

/** Work out what the file really is from its first bytes — never trust the name or declared type. */
export function sniffReceipt(buf: Buffer): ReceiptKind | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf.toString("ascii", 4, 8) === "ftyp" && /^(heic|heix|hevc|heim|heis|mif1|msf1)$/.test(buf.toString("ascii", 8, 12))) return "heic";
  if (buf.toString("ascii", 0, 5) === "%PDF-") return "pdf";
  return null;
}

function checkPdf(buf: Buffer): string | null {
  const text = buf.toString("latin1");
  if (!text.slice(-2048).includes("%%EOF")) return "This PDF looks damaged or incomplete. Download the receipt again from your banking app.";
  if (/\/Encrypt\b/.test(text)) return "This PDF is password-protected. Send a screenshot of the receipt instead.";
  const pages = (text.match(/\/Type\s*\/Page(?!s)\b/g) ?? []).length;
  // Bank PDFs often pack page objects into compressed object streams, where they can't be counted
  if (pages === 0 && !/\/ObjStm\b/.test(text)) return "This PDF has no pages. Send a screenshot of the receipt instead.";
  if (pages > MAX_PDF_PAGES) return `A receipt is usually one page — this PDF has ${pages}. Send just the transfer receipt.`;
  return null;
}

async function checkImage(buf: Buffer): Promise<string | null> {
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(buf).metadata();
  } catch {
    return "This image can't be opened. Take a new screenshot of the receipt.";
  }
  const w = meta.width ?? 0, h = meta.height ?? 0;
  if (Math.min(w, h) < MIN_SHORT_SIDE) {
    return "This image is too small to read. Send a full-size screenshot or photo of the receipt.";
  }
  if (Math.max(w, h) / Math.min(w, h) > MAX_ASPECT) {
    return "This doesn't look like a receipt. Send a screenshot that shows the whole transfer.";
  }
  // A single flat colour (blank, black or cropped-out) carries no receipt
  const { channels } = await sharp(buf).stats();
  if (channels.slice(0, 3).every((c) => c.stdev < 4)) {
    return "This image is blank. Send a screenshot that shows the transfer details.";
  }
  return null;
}

/**
 * Validates a receipt upload by its contents. Returns the real file kind, or a message
 * telling the player what to send instead.
 */
export async function checkReceipt(buf: Buffer): Promise<{ kind: ReceiptKind } | { error: string }> {
  const kind = sniffReceipt(buf);
  if (!kind) return { error: "That file isn't a photo or PDF. Send a screenshot (JPG or PNG) or the PDF from your banking app." };
  if (kind === "pdf") {
    const err = checkPdf(buf);
    return err ? { error: err } : { kind };
  }
  // HEIC can't be decoded here; its signature is enough, and Cloudinary converts it for viewing
  if (kind === "heic") return { kind };
  const err = await checkImage(buf);
  return err ? { error: err } : { kind };
}
