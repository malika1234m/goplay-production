import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sendSMS } from "@/lib/sms";
import { createNotification } from "@/lib/notify";
import { expireLobby } from "@/lib/open-match-engine";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const { status } = await req.json();

    if (!["ACTIVE", "INACTIVE", "REJECTED"].includes(status)) {
      return Response.json({ error: "Invalid status." }, { status: 400 });
    }

    const ground = await db.sportsFacility.update({
      where: { id },
      data:  { status },
      include: {
        owner: {
          include: {
            user: { select: { id: true, name: true, phone: true } },
          },
        },
      },
    });

    // When deactivating or rejecting — auto-expire all COLLECTING lobbies first
    let expiredLobbies = 0;
    if (status === "INACTIVE" || status === "REJECTED") {
      const activeLobbies = await db.openMatch.findMany({
        where:  { facilityId: id, status: "COLLECTING" },
        select: { id: true },
      });
      const reason = `This lobby was cancelled because ${ground.name} has been ${status === "INACTIVE" ? "deactivated" : "rejected"} by admin.`;
      for (const lobby of activeLobbies) {
        try { await expireLobby(lobby.id, reason); } catch { /* non-fatal */ }
      }
      expiredLobbies = activeLobbies.length;
    }

    // Notify ground owner on approval, deactivation, or rejection
    if (status === "ACTIVE" || status === "INACTIVE" || status === "REJECTED") {
      const ownerUserId = ground.owner.user.id;
      const ownerPhone  = ground.owner.user.phone;
      const ownerName   = ground.owner.user.name;

      const notifTitle   = status === "ACTIVE" ? "Ground Approved!" : status === "INACTIVE" ? "Ground Deactivated" : "Ground Rejected";
      const notifMessage = status === "ACTIVE"
        ? `Your ground "${ground.name}" has been approved by the admin and is now live on GoPlay.`
        : status === "INACTIVE"
        ? `Your ground "${ground.name}" has been temporarily deactivated by admin. Please contact GoPlay support for more information.`
        : `Your ground "${ground.name}" was not approved by the admin. Please contact support for more information.`;
      const notifType = status === "ACTIVE" ? "success" : "error";

      await createNotification({ userId: ownerUserId, title: notifTitle, message: notifMessage, type: notifType });

      if (ownerPhone) {
        const smsMessage = status === "ACTIVE"
          ? `GoPlay: Great news ${ownerName}! Your ground "${ground.name}" has been approved and is now live. Players can start booking it.`
          : status === "INACTIVE"
          ? `GoPlay: Hi ${ownerName}, your ground "${ground.name}" has been deactivated. Please contact GoPlay support for details.`
          : `GoPlay: Hi ${ownerName}, your ground "${ground.name}" was not approved. Please contact our support team for more information.`;
        await sendSMS(ownerPhone, smsMessage);
      }
    }

    return Response.json({ ground: { id: ground.id, name: ground.name, status: ground.status }, expiredLobbies });
  } catch (err) {
    console.error("[PUT /api/admin/grounds/[id]/status]", err);
    return Response.json({ error: "Failed to update status." }, { status: 500 });
  }
}
