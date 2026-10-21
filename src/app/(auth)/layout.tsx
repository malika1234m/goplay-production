import { PitchPanel, PitchBanner } from "@/components/auth/PitchPanel";

// Sign in, create account and password pages: the floodlit pitch beside the form on wide screens,
// a slim pitch banner above it on phones.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-slate-50">
      <PitchPanel />
      <div className="flex min-w-0 flex-1 flex-col">
        <PitchBanner />
        <main id="main" tabIndex={-1} className="relative z-10 -mt-10 flex flex-1 justify-center px-4 pb-12 lg:mt-0 lg:items-center lg:px-10 lg:py-12">
          {children}
        </main>
      </div>
    </div>
  );
}
