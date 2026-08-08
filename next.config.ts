import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.sandbox.payhere.lk https://www.payhere.lk",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://res.cloudinary.com https://nominatim.openstreetmap.org https://www.openstreetmap.org https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
              "connect-src 'self' https://res.cloudinary.com https://nominatim.openstreetmap.org",
              "frame-src https://www.sandbox.payhere.lk https://www.payhere.lk https://www.openstreetmap.org",
              "font-src 'self' data:",
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
