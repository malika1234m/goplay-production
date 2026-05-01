import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-green-950 flex flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="flex items-center gap-3 mb-8">
        <Image src="/logo.jpeg" alt="GoPlay" width={44} height={44} className="rounded-xl object-contain bg-white" />
        <span className="text-2xl font-bold text-white">
          Go<span className="text-green-400">Play</span>
        </span>
      </Link>
      {children}
    </div>
  );
}
