import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sendSMS } from "@/lib/sms";

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

    // Notify ground owner on approval or rejection
    if (status === "ACTIVE" || status === "REJECTED") {
      const ownerUserId = ground.owner.user.id;
      const ownerPhone  = ground.owner.user.phone;
      const ownerName   = ground.owner.user.name;

      const notifTitle   = status === "ACTIVE" ? "Ground Approved!" : "Ground Rejected";
      const notifMessage = status === "ACTIVE"
        ? `Your ground "${ground.name}" has been approved by the admin and is now live on GoPlay.`
        : `Your ground "${ground.name}" was not approved by the admin. Please contact support for more information.`;
      const notifType    = status === "ACTIVE" ? "success" : "error";

      await db.notification.create({
        data: { userId: ownerUserId, title: notifTitle, message: notifMessage, type: notifType },
      });

      if (ownerPhone) {
        const smsMessage = status === "ACTIVE"
          ? `GoPlay: Great news ${ownerName}! Your ground "${ground.name}" has been approved and is now live. Players can start booking it.`
          : `GoPlay: Hi ${ownerName}, your ground "${ground.name}" was not approved. Please contact our support team for more information.`;
        await sendSMS(ownerPhone, smsMessage);
      }
    }

    return Response.json({ ground: { id: ground.id, name: ground.name, status: ground.status } });
  } catch (err) {
    console.error("[PUT /api/admin/grounds/[id]/status]", err);
    return Response.json({ error: "Failed to update status." }, { status: 500 });
  }
}
