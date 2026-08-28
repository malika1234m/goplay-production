import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import GroundsSearch from "@/components/grounds/GroundsSearch";
import GroundsClient from "./GroundsClient";
import AdSlot from "@/components/ads/AdSlot";

export const metadata: Metadata = {
  title:       "Browse Grounds",
  description: "Find and book cricket, football, badminton, tennis courts and more sports grounds across Sri Lanka. Filter by sport, city, or price.",
  alternates:  { canonical: "/grounds" },
};

const CATEGORIES = ["All", "Cricket", "Football", "Futsal", "Tennis", "Badminton", "Basketball", "Volleyball", "Netball", "Rugby", "Swimming", "Table Tennis", "Pickleball", "Billiards & Pool"];

const categoryEmoji: Record<string, string> = {
  Cricket: "🏏", Football: "⚽", Futsal: "🥅", Tennis: "🎾",
  Badminton: "🏸", Basketball: "🏀", Volleyball: "🏐",
  Netball: "🏐", Rugby: "🏉", Swimming: "🏊", "Table Tennis": "🏓",
  Pickleball: "🏓", "Billiards & Pool": "🎱",
};

const PER_PAGE = 12;

async function getGrounds(q: string, city: string, category: string, page: number) {
  const where = {
    status: "ACTIVE" as const,
    ...(q && {
      OR: [
        { name:       { contains: q, mode: "insensitive" as const } },
        { city:       { contains: q, mode: "insensitive" as const } },
        { categories: { some: { name: { contains: q, mode: "insensitive" as const } } } },
      ],
    }),
    ...(city && { city: { contains: city, mode: "insensitive" as const } }),
    ...(category && category !== "All" && {
      categories: { some: { name: { equals: category, mode: "insensitive" as const } } },
    }),
  };

  const [rows, total] = await Promise.all([
    db.sportsFacility.findMany({
      where,
      include: {
        categories: true,
        reviews:    { select: { rating: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    db.sportsFacility.count({ where }),
  ]);

  const grounds = rows.map((g) => ({
    id:           g.id,
    name:         g.name,
    city:         g.city,
    hourlyRate:   g.hourlyRate,
    amenities:    g.amenities,
    images:       g.images,
    categories:   g.categories.map((c) => ({
      name: c.name,
      icon: c.icon ?? categoryEmoji[c.name] ?? null,
    })),
    avgRating:    g.reviews.length > 0
      ? Math.round((g.reviews.reduce((s, r) => s + r.rating, 0) / g.reviews.length) * 10) / 10
      : null,
    totalReviews: g.reviews.length,
    latitude:     g.latitude,
    longitude:    g.longitude,
  }));

  return { grounds, total };
}

function buildPageUrl(q: string, city: string, category: string, page: number) {
  const p = new URLSearchParams();
  if (q)                          p.set("q",        q);
  if (city)                       p.set("city",     city);
  if (category && category !== "All") p.set("category", category);
  if (page > 1)                   p.set("page",     String(page));
  const qs = p.toString();
  return qs ? `/grounds?${qs}` : "/grounds";
}

function getPageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const left  = current - 1;
  const right = current + 1;
  const nums: (number | "…")[] = [1];
  if (left > 2)          nums.push("…");
  for (let i = Math.max(2, left); i <= Math.min(total - 1, right); i++) nums.push(i);
  if (right < total - 1) nums.push("…");
  nums.push(total);
  return nums;
}

export default async function GroundsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; city?: string; category?: string; page?: string }>;
}) {
  const { q = "", city = "", category = "", page: pageParam = "1" } = await searchParams;
  const page       = Math.max(1, parseInt(pageParam) || 1);
  const { grounds, total } = await getGrounds(q, city, category, page);
  const totalPages = Math.ceil(total / PER_PAGE);
  const safePage   = Math.min(page, Math.max(1, totalPages));
  const pageNums   = totalPages > 1 ? getPageNumbers(safePage, totalPages) : [];

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Browse Grounds</h1>
          <p className="text-slate-500 text-sm">
            {total} {total === 1 ? "ground" : "grounds"} available
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

        {grounds.length > 0 && (
          <AdSlot name="grounds_footer" format="auto" className="mt-10" />
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-10 flex flex-col items-center gap-3">
            <div className="flex items-center gap-1">
              <Link
                href={buildPageUrl(q, city, category, safePage - 1)}
                aria-disabled={safePage <= 1}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  safePage <= 1
                    ? "pointer-events-none border-slate-100 text-slate-300 bg-white"
                    : "border-slate-200 text-slate-600 bg-white hover:border-green-500 hover:text-green-600"
                }`}
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </Link>

              {pageNums.map((p, i) =>
                p === "…" ? (
                  <span key={`e-${i}`} className="px-2 py-2 text-slate-400 text-sm select-none">…</span>
                ) : (
                  <Link
                    key={p}
                    href={buildPageUrl(q, city, category, p as number)}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium border transition-colors ${
                      p === safePage
                        ? "bg-green-600 border-green-600 text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:border-green-500 hover:text-green-600"
                    }`}
                  >
                    {p}
                  </Link>
                )
              )}

              <Link
                href={buildPageUrl(q, city, category, safePage + 1)}
                aria-disabled={safePage >= totalPages}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  safePage >= totalPages
                    ? "pointer-events-none border-slate-100 text-slate-300 bg-white"
                    : "border-slate-200 text-slate-600 bg-white hover:border-green-500 hover:text-green-600"
                }`}
              >
                Next <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <p className="text-xs text-slate-400">
              Page {safePage} of {totalPages} · {total} grounds total
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
