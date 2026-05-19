export default function GroundDetailLoading() {
  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">

          {/* Gallery skeleton */}
          <div className="lg:col-span-2 h-72 sm:h-96 bg-slate-200 rounded-2xl animate-pulse" />

          {/* Booking panel skeleton */}
          <div className="lg:col-start-3 lg:row-start-1 lg:row-span-6">
            <div className="bg-white rounded-2xl border border-slate-100 p-6">
              <div className="h-5 w-36 bg-slate-200 rounded animate-pulse mb-5" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse mb-3" />
              ))}
              <div className="h-12 bg-slate-200 rounded-xl animate-pulse mt-4" />
            </div>
          </div>

          {/* Header card skeleton */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6">
            <div className="h-4 w-24 bg-slate-200 rounded-full animate-pulse mb-3" />
            <div className="h-7 w-2/3 bg-slate-200 rounded   animate-pulse mb-2" />
            <div className="h-4 w-1/2 bg-slate-100 rounded   animate-pulse mb-4" />
            <div className="h-4 w-full bg-slate-100 rounded  animate-pulse mb-2" />
            <div className="h-4 w-3/4 bg-slate-100 rounded   animate-pulse" />
          </div>

          {/* Amenities skeleton */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6">
            <div className="h-5 w-28 bg-slate-200 rounded animate-pulse mb-4" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
