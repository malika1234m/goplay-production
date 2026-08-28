/**
 * Serves /ads.txt from the publisher ID. Google will not pay out on
 * programmatic demand without this file, so it is generated rather than
 * hand-maintained in /public.
 */
export const dynamic = "force-static";

export function GET() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

  if (!client?.startsWith("ca-pub-")) {
    return new Response("Not found", { status: 404 });
  }

  const publisherId = client.replace("ca-pub-", "pub-");
  const body = `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
