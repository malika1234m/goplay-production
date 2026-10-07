"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, Upload } from "lucide-react";

const MAX_BYTES = 8 * 1024 * 1024;

/** Picks a receipt photo/PDF and POSTs it as multipart field "receipt" to `endpoint`. */
export default function ReceiptUploader({
  endpoint,
  onUploaded,
  label = "Upload payment receipt",
}: {
  endpoint:   string;
  onUploaded: (receiptUrl: string) => void;
  label?:     string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file,      setFile]      = useState<File | null>(null);
  const [preview,   setPreview]   = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState("");

  const pick = (f: File | undefined) => {
    setError("");
    if (!f) return;
    if (f.size > MAX_BYTES) { setError("The receipt must be under 8 MB."); return; }
    setFile(f);
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("receipt", file);
      const res  = await fetch(endpoint, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Upload failed. Please try again."); return; }
      onUploaded(data.receiptUrl);
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl px-4 py-5 flex flex-col items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Receipt preview" className="max-h-48 rounded-lg object-contain" />
        ) : file ? (
          <span className="flex items-center gap-2 text-sm font-medium text-slate-700"><FileText className="w-5 h-5" />{file.name}</span>
        ) : (
          <>
            <Upload className="w-6 h-6" />
            <span className="text-sm font-medium">Choose a photo or PDF of your receipt</span>
            <span className="text-[11px] text-slate-400">JPEG, PNG, HEIC or PDF · up to 8 MB</span>
          </>
        )}
      </button>
      {file && (
        <button
          type="button"
          onClick={upload}
          disabled={uploading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
          {uploading ? "Uploading…" : label}
        </button>
      )}
      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>}
    </div>
  );
}
