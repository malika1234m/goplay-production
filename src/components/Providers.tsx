"use client";

import { SessionProvider } from "next-auth/react";
import NextTopLoader from "nextjs-toploader";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <NextTopLoader
        color="#22c55e"
        height={3}
        showSpinner={false}
        shadow="0 0 10px #22c55e, 0 0 5px #22c55e"
      />
      {children}
    </SessionProvider>
  );
}
