import Link from "next/link";
import { db } from "@/lib/db";
import GroundsSearch from "@/components/grounds/GroundsSearch";
import GroundsClient from "./GroundsClient";

const CATEGORIES = ["All", "Cricket", "Football", "Tennis", "Badminton", "Basketball", "Volleyball"];

const categoryEmoji: Record<string, string> = {
  Cricket: "🏏", Football: "⚽", Tennis: "🎾",
  Badminton: "🏸", Basketball: "🏀", Volleyball: "🏐",
};

async function getGrounds(q: string, city: string, category: string) {
  const grounds = await db.sportsFacility.findMany({
    where: {
      status: "ACTIVE",
      ...(q && {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } },
          { categories: { some: { name: { contains: q, mode: "insensitive" } } } },
        ],
      }),
      ...(city && { city: { contains: city, mode: "insensitive" } }),
      ...(category && category !== "All" && {
        categories: { some: { name: { equals: category, mode: "insensitive" } } },
      }),
    },
    include: {
      categories: true,
      reviews:    { select: { rating: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return grounds.map((g) => ({
    id:          g.id,
    name:        g.name,
    city:        g.city,
    hourlyRate:  g.hourlyRate,
    amenities:   g.amenities,
    images:      g.images,
    categories:  g.categories.map((c) => ({
      name: c.name,
      icon: c.icon ?? categoryEmoji[c.name] ?? null,
    })),
    avgRating:   g.reviews.length > 0
      ? Math.round((g.reviews.reduce((s, r) => s + r.rating, 0) / g.reviews.length) * 10) / 10
      : null,
    totalReviews: g.reviews.length,
    latitude:    g.latitude,
    longitude:   g.longitude,
  }));
}

export default async function GroundsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; city?: string; category?: string }>;
}) {
  const { q = "", city = "", category = "" } = await searchParams;
  const grounds = await getGrounds(q, city, category);

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Browse Grounds</h1>
          <p className="text-slate-500 text-sm">
            {grounds.length} {grounds.length === 1 ? "ground" : "grounds"} available
          </p>
          <GroundsSearch defaultQ={q} defaultCity={city} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Category pills */}
        <div className="flex gap-2 flex-wrap mb-8">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat}
              href={cat === "All" ? "/grounds" : `/grounds?category=${cat}`}
              className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
                (category === cat) || (cat === "All" && !category)
                  ? "bg-green-600 border-green-600 text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:border-green-500 hover:text-green-600"
              }`}
            >
              {categoryEmoji[cat] ?? ""} {cat}
            </Link>
          ))}
        </div>

        <GroundsClient grounds={grounds} q={q} category={category} />
      </div>
    </div>
  );
}
