import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sendSMS } from "@/lib/sms";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 });

    const { id }                   = await params;
    const { action, adminNotes, rejectionReason } = await req.json();

    if (!["approve", "reject"].includes(action)) return Response.json({ error: "Invalid action." }, { status: 400 });
    if (action === "reject" && !rejectionReason?.trim()) return Response.json({ error: "Rejection reason is required." }, { status: 400 });

    const application = await db.providerApplication.findUnique({
      where:   { id },
      include: { user: true },
    });
    if (!application) return Response.json({ error: "Application not found." }, { status: 404 });
    if (application.status !== "PENDING") return Response.json({ error: "Application has already been reviewed." }, { status: 409 });

    if (action === "approve") {
      // Sequential operations — explicit rollback on failure
      let profile: { id: string } | null = null;
      let facilityId: string | null = null;

      try {
        // 1. Mark application approved
        await db.providerApplication.update({
          where: { id },
          data:  { status: "APPROVED", adminNotes: adminNotes?.trim() || null, reviewedAt: new Date() },
        });

        // 2. Upgrade user role and flag password change
        await db.user.update({
          where: { id: application.userId },
          data:  { role: "GROUND_OWNER", mustChangePassword: true },
        });

        // 3. Create GroundOwnerProfile
        profile = await db.groundOwnerProfile.create({
          data: {
            userId:  application.userId,
            phone:   application.phone,
            address: application.address,
            city:    application.city,
          },
        });

        // 4. Create the facility (status PENDING — still needs admin approval for going live)
        const facility = await db.sportsFacility.create({
          data: {
            ownerId:     profile.id,
            categories:  { connect: application.categoryIds.map((cid) => ({ id: cid })) },
            name:        application.facilityName,
            address:     application.facilityAddress,
            city:        application.facilityCity,
            hourlyRate:  application.proposedHourlyRate,
            capacity:    application.capacity,
            amenities:   application.amenities ?? [],
            description: application.facilityDescription,
            images:      [],
            status:      "PENDING",
          },
        });
        facilityId = facility.id;

        // 5. Default availability Mon–Sun 06:00–22:00
        await db.facilityAvailability.createMany({
          data: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
            facilityId: facility.id,
            dayOfWeek:  day,
            openTime:   "06:00",
            closeTime:  "22:00",
            isOpen:     true,
          })),
        });
      } catch (stepErr: any) {
        // Rollback what we can
        if (facilityId) await db.sportsFacility.delete({ where: { id: facilityId } }).catch(() => {});
        if (profile)    await db.groundOwnerProfile.delete({ where: { id: profile.id } }).catch(() => {});
        // Revert user + application back to original state
        await db.user.update({ where: { id: application.userId }, data: { role: "USER", mustChangePassword: false } }).catch(() => {});
        await db.providerApplication.update({ where: { id }, data: { status: "PENDING", reviewedAt: null } }).catch(() => {});

        console.error("[APPROVE STEP FAILED]", stepErr);
        return Response.json({
          error:  "Approval failed at a specific step.",
          detail: stepErr?.message ?? String(stepErr),
          code:   stepErr?.code,
        }, { status: 500 });
      }

      // Notification — tell the owner to add photos before admin reviews the facility
      await db.notification.create({
        data: {
          userId:  application.userId,
          title:   "Application Approved! 🎉",
          message: `Congratulations! Your provider application has been approved. You are now a Ground Owner on GoPlay. Your facility "${application.facilityName}" has been created and is awaiting admin review. Head to your dashboard, add photos and any extra details to your ground, and we'll review it shortly.`,
          type:    "success",
        },
      });

      // SMS
      if (application.user.phone) {
        await sendSMS(
          application.user.phone,
          `GoPlay: Congratulations ${application.user.name}! Your provider application has been approved. You are now a Ground Owner. Login to your dashboard, add photos to your ground, and we'll get it live soon.`
        );
      }

      return Response.json({
        message:    "Application approved. User is now a Ground Owner.",
        facilityId: facilityId,
        facilityName: application.facilityName,
      });
    }

    // Reject
    await db.providerApplication.update({
      where: { id },
      data:  {
        status:          "REJECTED",
        rejectionReason: rejectionReason.trim(),
        adminNotes:      adminNotes?.trim() || null,
        reviewedAt:      new Date(),
      },
    });

    await db.notification.create({
      data: {
        userId:  application.userId,
        title:   "Application Not Approved",
        message: `Your provider application was not approved. Reason: ${rejectionReason.trim()}. You may reapply after addressing the feedback.`,
        type:    "error",
      },
    });

    if (application.user.phone) {
      await sendSMS(
        application.user.phone,
        `GoPlay: Hi ${application.user.name}, your provider application was not approved. Reason: ${rejectionReason.trim()}. Please contact support for help.`
      );
    }

    return Response.json({ message: "Application rejected." });
  } catch (err: any) {
    console.error("[PUT /api/admin/applications/[id]]", err);
    return Response.json({
      error:   "Failed to process application.",
      detail:  err?.message ?? String(err),
      code:    err?.code,
    }, { status: 500 });
  }
}
