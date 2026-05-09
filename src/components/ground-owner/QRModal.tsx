"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { X, Download, Printer } from "lucide-react";

interface Props {
  groundId:   string;
  groundName: string;
  city:       string;
  address:    string;
  onClose:    () => void;
}

export default function QRModal({ groundId, groundName, city, address, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [groundUrl, setGroundUrl] = useState("");

  useEffect(() => {
    const url = `${window.location.origin}/grounds/${groundId}`;
    setGroundUrl(url);
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, {
        width:  280,
        margin: 2,
        color:  { dark: "#0f172a", light: "#ffffff" },
      });
    }
  }, [groundId]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${groundName.replace(/\s+/g, "-").toLowerCase()}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handlePrint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>QR Code – ${groundName}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:system-ui,sans-serif;background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:32px}
    .poster{border:2px solid #e2e8f0;border-radius:20px;padding:40px 36px;text-align:center;max-width:380px;width:100%}
    .brand{font-size:30px;font-weight:800;letter-spacing:-1px;margin-bottom:4px}
    .brand .go{color:#16a34a}.brand .play{color:#0f172a}
    .tagline{font-size:12px;color:#94a3b8;margin-bottom:28px;text-transform:uppercase;letter-spacing:.5px}
    .qr-wrap{background:#fff;border:1px solid #f1f5f9;border-radius:14px;padding:14px;display:inline-block;margin-bottom:22px;box-shadow:0 2px 12px rgba(0,0,0,.06)}
    img{display:block;width:252px;height:252px}
    .ground-name{font-size:20px;font-weight:700;color:#0f172a;margin-bottom:5px}
    .ground-loc{font-size:13px;color:#64748b;margin-bottom:22px}
    .cta{background:#16a34a;color:#fff;font-size:14px;font-weight:700;padding:11px 28px;border-radius:10px;display:inline-block;margin-bottom:16px}
    .url{font-size:10px;color:#cbd5e1;word-break:break-all}
    @media print{body{padding:0}.poster{border:none;max-width:100%}}
  </style>
</head>
<body>
  <div class="poster">
    <div class="brand"><span class="go">Go</span><span class="play">Play</span></div>
    <div class="tagline">Book Sports Grounds Instantly</div>
    <div class="qr-wrap"><img src="${dataUrl}" alt="QR Code"/></div>
    <div class="ground-name">${groundName}</div>
    <div class="ground-loc">${address}, ${city}</div>
    <div class="cta">Scan to Book Your Slot</div>
    <div class="url">${groundUrl}</div>
  </div>
  <script>window.onload=()=>{window.print();}<\/script>
</body>
</html>`);
    win.document.close();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">QR Code Poster</h2>
            <p className="text-xs text-slate-400 mt-0.5">Scan to open booking page</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Preview */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 text-center mb-5">
          <p className="text-xl font-extrabold tracking-tight mb-0.5">
            <span className="text-green-600">Go</span>
            <span className="text-slate-900">Play</span>
          </p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-4">
            Book Sports Grounds Instantly
          </p>
          <div className="bg-white border border-slate-100 rounded-xl p-3 inline-block shadow-sm mb-4">
            <canvas ref={canvasRef} className="block" />
          </div>
          <p className="text-sm font-semibold text-slate-900">{groundName}</p>
          <p className="text-xs text-slate-500 mt-0.5">{city}</p>
          <div className="mt-3 bg-green-600 text-white text-xs font-bold px-4 py-2 rounded-lg inline-block">
            Scan to Book Your Slot
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium border border-slate-200 text-slate-700 py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" /> Download
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl transition-colors"
          >
            <Printer className="w-4 h-4" /> Print Poster
          </button>
        </div>
      </div>
    </div>
  );
}
