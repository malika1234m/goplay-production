import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getSetting } from "@/lib/settings";

// Only ONLINE payments (PayHere) land in the admin's account.
// Cash-on-arrival is collected directly by the ground owner — it never touches admin.
// Payout balance = net from ONLINE completed earnings - already paid out - pending requests.

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const profile = await db.groundOwnerProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        payouts: { orderBy: { requestedAt: "desc" } },
      },
    });
    if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });

    // Only ONLINE earnings — these are the funds the admin holds
    const onlineEarnings = await db.groundEarning.findMany({
      where: {
        ownerId:       profile.id,
        paymentMethod: "ONLINE",
        cashConfirmed: true, // payment was actually captured by PayHere
      },
      include: {
        facility: { select: { id: true, name: true, city: true } },
        booking: {
          select: {
            bookingDate: true,
            startTime:   true,
            endTime:     true,
            totalHours:  true,
            user:        { select: { name: true } },
          },
        },
      },
      orderBy: { earnedAt: "desc" },
    });

    const grossOnline = onlineEarnings.reduce((s, e) => s + e.grossAmount, 0);
    const feeOnline   = onlineEarnings.reduce((s, e) => s + e.platformFee, 0);
    const netOnline   = onlineEarnings.reduce((s, e) => s + e.netAmount,   0);

    // What has already been paid out or is in-flight
    const paidOut     = profile.payouts.filter((p) => p.status === "COMPLETED")
                          .reduce((s, p) => s + p.netAmount, 0);
    const inFlight    = profile.payouts.filter((p) => p.status === "PENDING" || p.status === "PROCESSING")
                          .reduce((s, p) => s + p.netAmount, 0);

    const availableBalance = Math.max(0, netOnline - paidOut - inFlight);
    const hasBankDetails   = !!(profile.bankName && profile.accountNumber && profile.accountHolderName);

    // Commission summary for ground owner view
    const allEarnings = await db.groundEarning.findMany({
      where: { ownerId: profile.id },
      select: { platformFee: true, commissionPaid: true, paymentMethod: true, earnedAt: true, commissionSettledAt: true,
                facility: { select: { name: true } },
                booking:  { select: { bookingDate: true } } },
      orderBy: { earnedAt: "desc" },
    });
    const totalCommission  = allEarnings.reduce((s, e) => s + e.platformFee, 0);
    const paidCommission   = allEarnings.filter((e) => e.commissionPaid).reduce((s, e) => s + e.platformFee, 0);
    const unpaidCommission = totalCommission - paidCommission;
    const cashUnpaid       = allEarnings.filter((e) => !e.commissionPaid && e.paymentMethod === "ON_ARRIVAL").reduce((s, e) => s + e.platformFee, 0);

    // Payout cooldown (read from settings)
    const [cooldownSetting, minPayoutSetting, commissionRateSetting] = await Promise.all([
      getSetting("payoutCooldownDays"),
      getSetting("minPayout"),
      getSetting("commissionRate"),
    ]);
    const lastPayout        = profile.payouts.find((p) => !p.isCommissionSettlement);
    const cooldownDays      = Number(cooldownSetting ?? "7");
    const cooldownMs        = cooldownDays * 24 * 60 * 60 * 1000;
    const lastPayoutAt      = lastPayout ? new Date(lastPayout.requestedAt).getTime() : 0;
    const msSinceLast       = Date.now() - lastPayoutAt;
    const cooldownRemaining = cooldownDays === 0 ? 0 : Math.max(0, Math.ceil((cooldownMs - msSinceLast) / (1000 * 60 * 60 * 24)));

    return Response.json({
      balance: {
        grossOnline,
        feeOnline,
        netOnline,
        paidOut,
        inFlight,
        availableBalance,
      },
      commission: {
        totalCommission,
        paidCommission,
        unpaidCommission,
        cashUnpaid,
      },
      onlineEarnings,
      hasBankDetails,
      // Real payout requests only (exclude commission netting records)
      payouts: profile.payouts.filter((p) => !p.isCommissionSettlement),
      // Commission settlements shown separately so owner understands their balance was reduced
      commissionSettlements: profile.payouts.filter((p) => p.isCommissionSettlement),
      cooldownRemaining,
      settings: {
        commissionRate:     Number(commissionRateSetting ?? "10"),
        minPayout:          Number(minPayoutSetting      ?? "1000"),
        payoutCooldownDays: cooldownDays,
      },
    });
  } catch (err) {
    console.error("[GET /api/ground-owner/payout]", err);
    return Response.json({ error: "Failed to fetch payout data." }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const profile = await db.groundOwnerProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        payouts: { select: { status: true, netAmount: true, isCommissionSettlement: true, requestedAt: true } },
      },
    });
    if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });

    if (!profile.bankName || !profile.accountNumber || !profile.accountHolderName) {
      return Response.json({ error: "Please add your bank details before requesting a payout." }, { status: 400 });
    }

    // Recalculate available balance
    const onlineEarnings = await db.groundEarning.findMany({
      where: { ownerId: profile.id, paymentMethod: "ONLINE", cashConfirmed: true },
      select: { grossAmount: true, platformFee: true, netAmount: true },
    });
    const grossOnline = onlineEarnings.reduce((s, e) => s + e.grossAmount, 0);
    const feeOnline   = onlineEarnings.reduce((s, e) => s + e.platformFee, 0);
    const netOnline   = onlineEarnings.reduce((s, e) => s + e.netAmount,   0);
    const paidOut     = profile.payouts.filter((p) => p.status === "COMPLETED").reduce((s, p) => s + p.netAmount, 0);
    const inFlight    = profile.payouts.filter((p) => p.status === "PENDING" || p.status === "PROCESSING").reduce((s, p) => s + p.netAmount, 0);
    const available   = Math.max(0, netOnline - paidOut - inFlight);

    const [minPayoutSetting, cooldownSetting] = await Promise.all([
      getSetting("minPayout"),
      getSetting("payoutCooldownDays"),
    ]);
    const MIN_PAYOUT    = Number(minPayoutSetting    ?? "1000");
    const COOLDOWN_DAYS = Number(cooldownSetting     ?? "7");

    if (available < MIN_PAYOUT) {
      return Response.json({ error: `Minimum payout amount is Rs. ${MIN_PAYOUT.toLocaleString()}.` }, { status: 400 });
    }

    const hasPending = profile.payouts.some((p) => !p.isCommissionSettlement && (p.status === "PENDING" || p.status === "PROCESSING"));
    if (hasPending) {
      return Response.json({ error: "You already have a payout request in progress." }, { status: 400 });
    }

    // Cooldown check (skipped if cooldown is 0)
    if (COOLDOWN_DAYS > 0) {
      const lastPayout = profile.payouts
        .filter((p) => !p.isCommissionSettlement)
        .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())[0];
      if (lastPayout) {
        const msSince   = Date.now() - new Date(lastPayout.requestedAt).getTime();
        const daysSince = msSince / (1000 * 60 * 60 * 24);
        if (daysSince < COOLDOWN_DAYS) {
          const daysLeft = Math.ceil(COOLDOWN_DAYS - daysSince);
          return Response.json({
            error: `You can request a payout once every ${COOLDOWN_DAYS} days. Please wait ${daysLeft} more day${daysLeft !== 1 ? "s" : ""}.`,
          }, { status: 429 });
        }
      }
    }

    // amount = what admin transfers; commission = 0 because fee is already deducted from netOnline
    const payout = await db.payout.create({
      data: {
        ownerId:    profile.id,
        amount:     available,
        commission: 0,
        netAmount:  available,
        status:     "PENDING",
      },
    });

    // Notify the ground owner
    await db.notification.create({
      data: {
        userId:  session.user.id,
        title:   "Payout Requested",
        message: `Your payout request of Rs. ${available.toLocaleString()} has been submitted. The admin will review and transfer to your bank account shortly.`,
        type:    "info",
      },
    });

    // Notify all admins
    const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    if (admins.length > 0) {
      await db.notification.createMany({
        data: admins.map((a) => ({
          userId:  a.id,
          title:   "Payout Request",
          message: `${session.user.name} has requested a payout of Rs. ${available.toLocaleString()}. Review in the Payouts dashboard.`,
          type:    "info",
        })),
      });
    }

    return Response.json({ payout, message: "Payout request submitted." }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/ground-owner/payout]", err);
    return Response.json({ error: "Failed to request payout." }, { status: 500 });
  }
}
