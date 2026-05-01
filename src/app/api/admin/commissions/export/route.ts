import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells
    .map((c) => {
      const s = c == null ? "" : String(c);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    })
    .join(",");
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const ownerId  = searchParams.get("ownerId")  ?? undefined;
  const status   = searchParams.get("status")   ?? "all";   // "paid" | "unpaid" | "all"
  const from     = searchParams.get("from")     ?? undefined;
  const to       = searchParams.get("to")       ?? undefined;

  const earnings = await db.groundEarning.findMany({
    where: {
      ...(ownerId ? { ownerId } : {}),
      ...(status === "paid"   ? { commissionPaid: true  } : {}),
      ...(status === "unpaid" ? { commissionPaid: false } : {}),
      ...(from || to ? {
        earnedAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to   ? { lte: new Date(to + "T23:59:59Z") } : {}),
        },
      } : {}),
    },
    include: {
      owner:    { include: { user: { select: { name: true, email: true } } } },
      facility: { select: { name: true, city: true } },
      booking:  { select: { bookingDate: true, startTime: true, endTime: true, totalAmount: true } },
    },
    orderBy: { earnedAt: "desc" },
  });

  const headers = [
    "Owner Name",
    "Owner Email",
    "Facility",
    "City",
    "Booking Date",
    "Time Slot",
    "Payment Method",
    "Gross Amount (Rs.)",
    "Commission Amount (Rs.)",
    "Net to Owner (Rs.)",
    "Commission Status",
    "Earned At",
    "Settled At",
    "Settlement Note",
  ];

  const rows = earnings.map((e) =>
    csvRow([
      e.owner.user.name,
      e.owner.user.email,
      e.facility.name,
      e.facility.city,
      new Date(e.booking.bookingDate).toLocaleDateString("en-GB"),
      `${e.booking.startTime}–${e.booking.endTime}`,
      e.paymentMethod === "ONLINE" ? "Online (PayHere)" : "Cash on Arrival",
      Math.round(e.grossAmount),
      Math.round(e.platformFee),
      Math.round(e.netAmount),
      e.commissionPaid ? "Paid" : "Unpaid",
      new Date(e.earnedAt).toLocaleDateString("en-GB"),
      e.commissionSettledAt ? new Date(e.commissionSettledAt).toLocaleDateString("en-GB") : "",
      e.commissionNote ?? "",
    ])
  );

  const csv = [csvRow(headers), ...rows].join("\r\n");

  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename  = `goplay-commissions-${dateStamp}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
