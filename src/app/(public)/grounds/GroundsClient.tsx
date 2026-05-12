"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Star, Map, LayoutGrid, Navigation, Loader2 } from "lucide-react";
import { haversineKm } from "@/lib/geocode";
import type { MapGround } from "@/components/maps/GroundsMap";

const GroundsMap = dynamic(() => import("@/components/maps/GroundsMap"), { ssr: false });

export interface GroundItem {
  id: string;
  name: string;
  city: string;
  hourlyRate: number;
  amenities: string[];
  images: string[];
  categories: { name: string; icon: string | null }[];
  avgRating: number | null;
  totalReviews: number;
  latitude: number | null;
  longitude: number | null;
}

const RADII = [5, 10, 25, 50] as const;

interface Props {
  grounds: GroundItem[];
  q: string;
  category: string;
}

export default function GroundsClient({ grounds, q, category }: Props) {
  const [view, setView] = useState<"grid" | "map">("grid");
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [nearMe, setNearMe] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  function handleNearMe() {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setNearMe(true);
        setGeoLoading(false);
        setView("map");
      },
      () => {
        setGeoError("Could not get your location. Please allow location access.");
        setGeoLoading(false);
      }
    );
  }

  function clearNearMe() {
    setNearMe(false);
    setUserLat(null);
    setUserLng(null);
  }

  const filtered = useMemo(() => {
    if (!nearMe || !userLat || !userLng) return grounds;
    return grounds.filter((g) => {
      if (!g.latitude || !g.longitude) return false;
      return haversineKm(userLat, userLng, g.latitude, g.longitude) <= radiusKm;
    });
  }, [grounds, nearMe, userLat, userLng, radiusKm]);

  const mapGrounds = useMemo<MapGround[]>(
    () =>
      filtered
        .filter((g) => g.latitude && g.longitude)
        .map((g) => ({
          id: g.id,
          name: g.name,
          city: g.city,
          hourlyRate: g.hourlyRate,
          category: g.categories[0]?.name ?? "",
          avgRating: g.avgRating,
          lat: g.latitude!,
          lng: g.longitude!,
        })),
    [filtered]
  );

  return (
    <>
      {/* Controls row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          {/* Near Me */}
          {nearMe ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-green-700 font-medium bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
                📍 Near Me
              </span>
              <div className="flex items-center gap-1">
                {RADII.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRadiusKm(r)}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                      radiusKm === r
                        ? "bg-green-600 border-green-600 text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:border-green-500"
                    }`}
                  >
                    {r} km
                  </button>
                ))}
              </div>
              <button
                onClick={clearNearMe}
                className="text-xs text-slate-500 hover:text-red-500 underline"
              >
                Clear
              </button>
            </div>
          ) : (
            <button
              onClick={handleNearMe}
              disabled={geoLoading}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:border-green-500 hover:text-green-600 px-3 py-1.5 rounded-full transition-colors disabled:opacity-60"
            >
              {geoLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Navigation className="w-3.5 h-3.5" />
              )}
              Near Me
            </button>
          )}
          {geoError && <span className="text-xs text-red-500">{geoError}</span>}
        </div>

        {/* Grid / Map toggle */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
          <button
            onClick={() => setView("grid")}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md font-medium transition-colors ${
              view === "grid"
                ? "bg-green-600 text-white"
                : "text-slate-600 hover:text-green-600"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Grid
          </button>
          <button
            onClick={() => setView("map")}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md font-medium transition-colors ${
              view === "map"
                ? "bg-green-600 text-white"
                : "text-slate-600 hover:text-green-600"
            }`}
          >
            <Map className="w-3.5 h-3.5" /> Map
          </button>
        </div>
      </div>

      {nearMe && (
        <p className="text-sm text-slate-500 mb-4">
          Showing {filtered.length} ground{filtered.length !== 1 ? "s" : ""} within {radiusKm} km of your location.
          {filtered.length < grounds.length && (
            <span className="ml-1">
              ({grounds.length - filtered.length} outside range or no coordinates)
            </span>
          )}
        </p>
      )}

      {/* Map view */}
      {view === "map" && (
        <div className="mb-4">
          {mapGrounds.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 py-20 text-center">
              <Map className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-400">No mapped grounds found. Coordinates may not be set for these facilities.</p>
            </div>
          ) : (
            <GroundsMap
              grounds={mapGrounds}
              userLat={userLat ?? undefined}
              userLng={userLng ?? undefined}
              radiusKm={nearMe ? radiusKm : undefined}
            />
          )}
        </div>
      )}

      {/* Grid view */}
      {view === "grid" && (
        <>
          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 py-20 text-center">
              <div className="text-6xl mb-4">🏟️</div>
              <h3 className="text-base font-semibold text-slate-900 mb-1">No grounds found</h3>
              <p className="text-sm text-slate-400 max-w-xs mx-auto">
                {nearMe
                  ? `No grounds found within ${radiusKm} km of your location. Try a larger radius.`
                  : q || category
                  ? "Try adjusting your search filters."
                  : "Grounds will appear here once ground owners list their facilities."}
              </p>
              {(q || category) && (
                <Link href="/grounds" className="mt-5 inline-block text-sm text-green-600 font-medium hover:underline">
                  Clear filters
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((ground) => {
                const primaryCat = ground.categories[0];
                const fallbackIcon = primaryCat?.icon ?? "🏟️";
                return (
                  <Link
                    key={ground.id}
                    href={`/grounds/${ground.id}`}
                    className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all group"
                  >
                    <div className="h-44 bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center relative overflow-hidden">
                      {ground.images && ground.images.length > 0 ? (
                        <Image
                          src={ground.images[0]}
                          alt={ground.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                      ) : (
                        <span className="text-7xl">{fallbackIcon}</span>
                      )}
                      {/* Sport badges */}
                      <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                        {ground.categories.slice(0, 2).map((c) => (
                          <span
                            key={c.name}
                            className="bg-white/90 text-slate-700 text-xs font-medium px-2 py-0.5 rounded-full border border-slate-100"
                          >
                            {c.icon} {c.name}
                          </span>
                        ))}
                        {ground.categories.length > 2 && (
                          <span className="bg-white/90 text-slate-500 text-xs font-medium px-2 py-0.5 rounded-full border border-slate-100">
                            +{ground.categories.length - 2}
                          </span>
                        )}
                      </div>
                      <div className="absolute top-3 right-3">
                        <span className="bg-green-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                          Rs. {ground.hourlyRate.toLocaleString()}/hr
                        </span>
                      </div>
                      {ground.images && ground.images.length > 1 && (
                        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                          +{ground.images.length - 1} photos
                        </div>
                      )}
                    </div>

                    <div className="p-5">
                      <h3 className="font-semibold text-slate-900 group-hover:text-green-600 transition-colors mb-1 truncate">
                        {ground.name}
                      </h3>
                      <div className="flex items-center gap-1 text-slate-500 text-sm mb-3">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span>{ground.city}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {ground.avgRating ? (
                            <>
                              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                              <span className="text-sm font-medium text-slate-900">{ground.avgRating}</span>
                              <span className="text-xs text-slate-400">({ground.totalReviews})</span>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400">No reviews yet</span>
                          )}
                        </div>
                        <div className="flex gap-1.5">
                          {ground.amenities.slice(0, 2).map((a) => (
                            <span key={a} className="text-xs bg-slate-50 border border-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                              {a}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
