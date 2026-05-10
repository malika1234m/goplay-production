"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export default function ListGroundButton() {
  const { data: session } = useSession();

  const href = session?.user ? "/become-provider" : "/register";

  return (
    <Link
      href={href}
      className="bg-green-500 hover:bg-green-400 text-white font-bold px-10 py-4 rounded-xl transition-colors text-base shadow-lg shadow-green-900/40"
    >
      List Your Ground — Free
    </Link>
  );
}
