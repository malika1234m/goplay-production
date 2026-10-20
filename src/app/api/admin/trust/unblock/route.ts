import { NextRequest } from "next/server";
import { forbidden, requireAdmin } from "@/lib/admin-guard";
import { unblockAccount } from "@/lib/trust";

// POST /api/admin/trust/unblock — { blockId, note? }
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return forbidden();
    const { blockId, note } = await req.json().catch(() => ({}));
    const r = await unblockAccount({ blockId: String(blockId ?? ""), adminId: admin.id, note });
    if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
    return Response.json({ message: "Block lifted." });
  } catch (err) {
    console.error("[POST /api/admin/trust/unblock]", err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
