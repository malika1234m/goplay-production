import type { NextConfig } from "next";

// Google AdSense pulls scripts, pixels and ad iframes from a wide set of
// hosts, plus fundingchoicesmessages.google.com for the GDPR consent banner
// (Google's CMP) shown to EEA/UK/Swiss visitors. Missing any of these makes
// ads or the consent banner silently fail with only a CSP violation in the
// console, so they are grouped here per directive.
const ADS = {
  script: [
    "https://pagead2.googlesyndication.com",
    "https://partner.googleadservices.com",
    "https://tpc.googlesyndication.com",
    "https://www.googletagservices.com",
    "https://adservice.google.com",
    "https://ep2.adtrafficquality.google",
    "https://fundingchoicesmessages.google.com",
  ],
  img: [
    "https://pagead2.googlesyndication.com",
    "https://googleads.g.doubleclick.net",
    "https://tpc.googlesyndication.com",
    "https://www.google.com",
    "https://www.google.lk",
    "https://ep1.adtrafficquality.google",
    "https://fundingchoicesmessages.google.com",
  ],
  connect: [
    "https://pagead2.googlesyndication.com",
    "https://googleads.g.doubleclick.net",
    "https://tpc.googlesyndication.com",
    "https://ep1.adtrafficquality.google",
    "https://csi.gstatic.com",
    "https://fundingchoicesmessages.google.com",
  ],
  frame: [
    "https://googleads.g.doubleclick.net",
    "https://tpc.googlesyndication.com",
    "https://www.google.com",
    "https://ep2.adtrafficquality.google",
    "https://fundingchoicesmessages.google.com",
  ],
  font: ["https://fonts.gstatic.com"],
};

// Seed/demo facility images are served from the dev machine, and the mobile
// app reaches it as 10.0.2.2 (the Android emulator's alias for the host).
// Those hosts are allowed in development only, so `/grounds` renders in a
// desktop browser without shipping a private address in the production config.
const DEV_IMAGE_HOSTS: NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]> =
  process.env.NODE_ENV === "production"
    ? []
    : [
        { protocol: "http", hostname: "10.0.2.2",  pathname: "/**" },
        { protocol: "http", hostname: "localhost", pathname: "/**" },
      ];

// A production deploy missing any of these would go live broken or unprotected (no bot check,
// unauthenticated crons, no sessions), so the build stops instead and the current version stays up.
const REQUIRED_IN_PRODUCTION = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "CRON_SECRET",
  "TURNSTILE_SECRET_KEY",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
];
if (process.env.VERCEL_ENV === "production") {
  const missing = REQUIRED_IN_PRODUCTION.filter((k) => !process.env[k]?.trim());
  if (missing.length) throw new Error(`Missing production environment variables: ${missing.join(", ")}`);
}

const nextConfig: NextConfig = {
  compress: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      ...DEV_IMAGE_HOSTS,
    ],
    minimumCacheTTL: 60,
    deviceSizes:     [640, 750, 828, 1080, 1200, 1920],
    imageSizes:      [16, 32, 48, 64, 96, 128, 256, 384],
  },
  // www pages move to goplay.lk, but /api stays put: a redirect to another host drops the
  // Authorization header, which logs out every mobile app build pointed at www.goplay.lk.
  async redirects() {
    return [
      // Common guesses at the sign-in and sign-up addresses
      { source: "/signin",  destination: "/login",    permanent: true },
      { source: "/sign-in", destination: "/login",    permanent: true },
      { source: "/signup",  destination: "/register", permanent: true },
      { source: "/sign-up", destination: "/register", permanent: true },
      {
        source:      "/:path((?!api/).*)",
        has:         [{ type: "host", value: "www.goplay.lk" }],
        destination: "https://goplay.lk/:path",
        permanent:   true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options",        value: "DENY" },
          { key: "X-XSS-Protection",       value: "1; mode=block" },
          { key: "Referrer-Policy",        value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",     value: "camera=(), microphone=(), geolocation=(self)" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com ${ADS.script.join(" ")}`,
              "style-src 'self' 'unsafe-inline'",
              `img-src 'self' data: blob: https://res.cloudinary.com https://nominatim.openstreetmap.org https://www.openstreetmap.org https://tile.openstreetmap.org https://*.tile.openstreetmap.org ${ADS.img.join(" ")}`,
              `connect-src 'self' https://res.cloudinary.com https://nominatim.openstreetmap.org https://challenges.cloudflare.com ${ADS.connect.join(" ")}`,
              `frame-src https://www.openstreetmap.org https://challenges.cloudflare.com ${ADS.frame.join(" ")}`,
              `font-src 'self' data: ${ADS.font.join(" ")}`,
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
