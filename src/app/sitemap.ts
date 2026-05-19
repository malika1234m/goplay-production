import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://goplay.lk";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const grounds = await db.sportsFacility.findMany({
    where:  { status: "ACTIVE" },
    select: { id: true, updatedAt: true },
  });

  const groundUrls: MetadataRoute.Sitemap = grounds.map((g) => ({
    url:             `${siteUrl}/grounds/${g.id}`,
    lastModified:    g.updatedAt,
    changeFrequency: "weekly",
    priority:        0.8,
  }));

  return [
    { url: siteUrl,                    lastModified: new Date(), changeFrequency: "daily",   priority: 1.0 },
    { url: `${siteUrl}/grounds`,       lastModified: new Date(), changeFrequency: "daily",   priority: 0.9 },
    { url: `${siteUrl}/about`,         lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/support`,       lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/privacy`,       lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/terms`,         lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/refund-policy`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    ...groundUrls,
  ];
}
