import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Star, Clock, Users, CheckCircle, ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import BookingForm from "@/components/booking/BookingForm";
import GroundImageGallery from "@/components/grounds/GroundImageGallery";
import FacilityMapWrapper from "@/components/maps/FacilityMapWrapper";

const categoryEmoji: Record<string, string> = {
  Cricket: "🏏", Football: "⚽", Tennis: "🎾",
  Badminton: "🏸", Basketball: "🏀", Volleyball: "🏐",
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

async function getGround(id: string) {
  const ground = await db.sportsFacility.findUnique({
    where: { id, status: "ACTIVE" },
    include: {
      categories: true,
      availability: { orderBy: { dayOfWeek: "asc" } },
      courts: {
        where:   { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select:  { id: true, name: true, description: true },
      },
      reviews: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });
  return ground;
}

export default async function GroundDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ground = await getGround(id);

  if (!ground) notFound();

  const avgRating =
    ground.reviews.length > 0
      ? Math.round(
          (ground.reviews.reduce((s, r) => s + r.rating, 0) / ground.reviews.length) * 10
        ) / 10
      : null;

  const primaryCategory = ground.categories[0];
  const categoryIcon = primaryCategory
    ? (primaryCategory.icon ?? categoryEmoji[primaryCategory.name] ?? "🏟️")
    : "🏟️";

  const todayDow = new Date().getDay();

  const availabilityProps = ground.availability.map((a) => ({
    dayOfWeek: a.dayOfWeek,
    isOpen:    a.isOpen,
    openTime:  a.openTime,
    closeTime: a.closeTime,
  }));

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Back breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <Link
          href="/grounds"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-green-600 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Grounds
        </Link>
      </div>

      {/*
        Grid layout strategy:
        - Mobile (1 col): DOM order = gallery → header → booking form → amenities → hours → map → reviews
        - Desktop (3 cols): booking panel is explicitly placed at col 3, rows 1–6 (sticky);
          all other sections auto-fill cols 1–2 in DOM order
      */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">

          {/* ── 1. Gallery ── cols 1-2 on desktop */}
          <div className="lg:col-span-2">
            <GroundImageGallery
              images={ground.images}
              categoryIcon={categoryIcon}
              altText={ground.name}
            />
          </div>

          {/* ── 2. Header card ── cols 1-2 on desktop */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-100 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center flex-wrap gap-1.5 mb-2">
                    {ground.categories.map((c) => (
                      <span key={c.id} className="text-xs font-medium bg-green-50 text-green-700 border border-green-100 px-2.5 py-1 rounded-full">
                        {c.icon} {c.name}
                      </span>
                    ))}
                  </div>
                  <h1 className="text-2xl font-bold text-slate-900">{ground.name}</h1>
                  <div className="flex items-center gap-1 text-slate-500 text-sm mt-1">
                    <MapPin className="w-4 h-4" />
                    <span>{ground.address}, {ground.city}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold text-green-600">
                    Rs. {ground.hourlyRate.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400">per hour</p>
                </div>
              </div>

              <div className="flex items-center gap-5 mt-4 pt-4 border-t border-slate-50">
                <div className="flex items-center gap-1.5">
                  {avgRating ? (
                    <>
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span className="text-sm font-semibold text-slate-900">{avgRating}</span>
                      <span className="text-xs text-slate-400">({ground.reviews.length} reviews)</span>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">No reviews yet</span>
                  )}
                </div>
                {ground.capacity && (
                  <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                    <Users className="w-4 h-4" />
                    <span>Up to {ground.capacity} players</span>
                  </div>
                )}
              </div>

              {ground.description && (
                <p className="text-slate-600 text-sm leading-relaxed mt-4">{ground.description}</p>
              )}
            </div>
          </div>

          {/* ── 3. Booking panel ──
               Mobile: flows here in DOM order (after gallery + header)
               Desktop: explicitly placed at col 3, rows 1–6 (sticky) */}
          <div className="lg:col-start-3 lg:row-start-1 lg:row-span-6">
            <div className="bg-white rounded-2xl border border-slate-100 p-6 lg:sticky lg:top-24">
              <h2 className="text-base font-semibold text-slate-900 mb-5">Book This Ground</h2>
              <BookingForm
                facilityId={ground.id}
                hourlyRate={ground.hourlyRate}
                availability={availabilityProps}
                courts={ground.courts}
              />
            </div>
          </div>

          {/* ── 4. Amenities ── cols 1-2 on desktop */}
          {ground.amenities.length > 0 && (
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <h2 className="text-base font-semibold text-slate-900 mb-4">Amenities</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {ground.amenities.map((a) => (
                    <div key={a} className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                      {a}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── 5. Courts / Fields ── cols 1-2 on desktop */}
          {ground.courts.length > 0 && (
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <h2 className="text-base font-semibold text-slate-900 mb-4">
                  Courts &amp; Fields
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    ({ground.courts.length} available — select one when booking)
                  </span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ground.courts.map((c) => (
                    <div key={c.id} className="flex items-start gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                      <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                        {c.name[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                        {c.description && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{c.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── 7. Opening hours ── cols 1-2 on desktop */}
          {ground.availability.length > 0 && (
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <h2 className="text-base font-semibold text-slate-900 mb-4">Opening Hours</h2>
                <div className="flex flex-col gap-1.5">
                  {DAYS.map((dayName, dow) => {
                    const entry   = ground.availability.find((a) => a.dayOfWeek === dow);
                    const isOpen  = entry?.isOpen ?? false;
                    const isToday = dow === todayDow;
                    return (
                      <div
                        key={dow}
                        className={`flex items-center justify-between text-sm px-3 py-2 rounded-lg ${isToday ? "bg-green-50 border border-green-100" : ""}`}
                      >
                        <span className={`font-medium ${isToday ? "text-green-700" : "text-slate-600"}`}>
                          {dayName}{isToday && <span className="ml-1.5 text-[10px] font-semibold bg-green-600 text-white px-1.5 py-0.5 rounded-full">Today</span>}
                        </span>
                        {isOpen && entry ? (
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{entry.openTime} – {entry.closeTime}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">Closed</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── 6. Location map ── cols 1-2 on desktop */}
          {ground.latitude && ground.longitude && (
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <h2 className="text-base font-semibold text-slate-900 mb-4">Location</h2>
                <FacilityMapWrapper
                  lat={ground.latitude}
                  lng={ground.longitude}
                  name={ground.name}
                  address={`${ground.address}, ${ground.city}`}
                />
              </div>
            </div>
          )}

          {/* ── 7. Reviews ── cols 1-2 on desktop */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-100 p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-slate-900">
                  Reviews{" "}
                  <span className="text-slate-400 font-normal">({ground.reviews.length})</span>
                </h2>
                {avgRating && (
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="text-sm font-semibold text-slate-900">{avgRating}</span>
                  </div>
                )}
              </div>

              {ground.reviews.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">
                  No reviews yet. Be the first to review after your booking!
                </p>
              ) : (
                <div className="flex flex-col gap-5">
                  {ground.reviews.map((r) => (
                    <div
                      key={r.id}
                      className="pb-5 border-b border-slate-50 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-bold">
                            {r.user.name[0].toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-slate-900">{r.user.name}</span>
                        </div>
                        <span className="text-xs text-slate-400">
                          {new Date(r.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <div className="flex mb-2">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${
                              i < r.rating
                                ? "text-amber-400 fill-amber-400"
                                : "text-slate-200 fill-slate-200"
                            }`}
                          />
                        ))}
                      </div>
                      {r.reviewText && (
                        <p className="text-sm text-slate-600 leading-relaxed">{r.reviewText}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
