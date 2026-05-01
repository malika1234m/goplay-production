import { db } from "@/lib/db";

export async function GET() {
  try {
    const categories = await db.sportsCategory.findMany({ orderBy: { name: "asc" } });
    return Response.json({ categories });
  } catch (err) {
    console.error("[GET /api/categories]", err);
    return Response.json({ error: "Failed to fetch categories." }, { status: 500 });
  }
}
