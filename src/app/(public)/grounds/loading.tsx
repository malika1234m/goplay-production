export default function GroundsLoading() {
  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="h-7 w-44 bg-slate-200 rounded-lg animate-pulse mb-2" />
          <div className="h-4 w-32 bg-slate-100 rounded   animate-pulse mb-5" />
          <div className="h-12 bg-slate-100 rounded-xl    animate-pulse" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Category pills skeleton */}
        <div className="flex gap-2 flex-wrap mb-8">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-9 w-24 bg-slate-200 rounded-full animate-pulse" />
          ))}
        </div>

        {/* Cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="h-44 bg-slate-200 animate-pulse" />
              <div className="p-5">
                <div className="h-5 w-3/4 bg-slate-200 rounded animate-pulse mb-2" />
                <div className="h-4 w-1/2 bg-slate-100 rounded animate-pulse mb-4" />
                <div className="flex justify-between">
                  <div className="h-4 w-16 bg-slate-100 rounded animate-pulse" />
                  <div className="h-4 w-20 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
