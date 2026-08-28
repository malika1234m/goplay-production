import type { NextConfig } from "next";

// Google AdSense pulls scripts, pixels and ad iframes from a wide set of
// hosts. Missing any of these makes ads silently fail to render with only a
// CSP violation in the console, so they are grouped here per directive.
const ADS = {
  script: [
    "https://pagead2.googlesyndication.com",
    "https://partner.googleadservices.com",
    "https://tpc.googlesyndication.com",
    "https://www.googletagservices.com",
    "https://adservice.google.com",
    "https://ep2.adtrafficquality.google",
  ],
  img: [
    "https://pagead2.googlesyndication.com",
    "https://googleads.g.doubleclick.net",
    "https://tpc.googlesyndication.com",
    "https://www.google.com",
    "https://www.google.lk",
    "https://ep1.adtrafficquality.google",
  ],
  connect: [
    "https://pagead2.googlesyndication.com",
    "https://googleads.g.doubleclick.net",
    "https://tpc.googlesyndication.com",
    "https://ep1.adtrafficquality.google",
    "https://csi.gstatic.com",
  ],
  frame: [
    "https://googleads.g.doubleclick.net",
    "https://tpc.googlesyndication.com",
    "https://www.google.com",
    "https://ep2.adtrafficquality.google",
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
              `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.sandbox.payhere.lk https://www.payhere.lk ${ADS.script.join(" ")}`,
              "style-src 'self' 'unsafe-inline'",
              `img-src 'self' data: blob: https://res.cloudinary.com https://nominatim.openstreetmap.org https://www.openstreetmap.org https://tile.openstreetmap.org https://*.tile.openstreetmap.org ${ADS.img.join(" ")}`,
              `connect-src 'self' https://res.cloudinary.com https://nominatim.openstreetmap.org ${ADS.connect.join(" ")}`,
              `frame-src https://www.sandbox.payhere.lk https://www.payhere.lk https://www.openstreetmap.org ${ADS.frame.join(" ")}`,
              `font-src 'self' data: ${ADS.font.join(" ")}`,
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self' https://www.sandbox.payhere.lk https://www.payhere.lk",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
