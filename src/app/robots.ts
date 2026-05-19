import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://goplay.lk";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard/",
          "/my-bookings/",
          "/profile/",
          "/ground-owner/",
          "/admin/",
          "/coach/",
          "/shop/",
          "/payment/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
