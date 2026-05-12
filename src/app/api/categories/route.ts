import { db } from "@/lib/db";

export async function GET() {
  try {
    const categories = await db.sportsCategory.findMany({ orderBy: { name: "asc" } });
    return Response.json({ categories }, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("[GET /api/categories]", err);
    return Response.json({ error: "Failed to fetch categories." }, { status: 500 });
  }
}
