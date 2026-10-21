-- GoPlay data-integrity checks — READ ONLY.
-- Every check returns: check id, what it means, how many rows violate it, up to 5 example ids.
-- Safe on production: the whole script runs inside a READ ONLY transaction and is rolled back.
-- Run:  psql "$DATABASE_URL" -X -P pager=off -f scripts/sql/integrity-checks.sql
-- Dates are compared in Sri Lanka time (UTC+05:30); bookingDate is stored at UTC midnight.

BEGIN READ ONLY;
SET LOCAL statement_timeout = '60s';

WITH lk AS (SELECT (now() AT TIME ZONE 'Asia/Colombo')::date AS today),
checks AS (

  -- ── Earnings vs bookings ─────────────────────────────────────────────
  SELECT 'E1' id, 'GroundEarning without a matching booking' what, e.id ref
    FROM "GroundEarning" e LEFT JOIN "FacilityBooking" b ON b.id = e."bookingId" WHERE b.id IS NULL
  UNION ALL
  SELECT 'E2', 'GroundEarning on a booking that is not COMPLETED', e.id
    FROM "GroundEarning" e JOIN "FacilityBooking" b ON b.id = e."bookingId" WHERE b.status <> 'COMPLETED'
  UNION ALL
  SELECT 'E3', 'COMPLETED booking with no GroundEarning', b.id
    FROM "FacilityBooking" b LEFT JOIN "GroundEarning" e ON e."bookingId" = b.id WHERE b.status = 'COMPLETED' AND e.id IS NULL
  UNION ALL
  SELECT 'E4', 'GroundEarning facility/owner differs from the booking''s ground', e.id
    FROM "GroundEarning" e JOIN "FacilityBooking" b ON b.id = e."bookingId" JOIN "SportsFacility" f ON f.id = b."facilityId"
   WHERE e."facilityId" <> b."facilityId" OR e."ownerId" <> f."ownerId"
  UNION ALL
  SELECT 'E5', 'GroundEarning net <> gross - fee', e.id
    FROM "GroundEarning" e WHERE abs(e."netAmount" - (e."grossAmount" - e."platformFee")) > 0.01
  UNION ALL
  SELECT 'E6', 'GroundEarning commissionPaid=true but no settlement date', e.id
    FROM "GroundEarning" e WHERE e."commissionPaid" AND e."commissionSettledAt" IS NULL

  -- ── Booking status vs payment ────────────────────────────────────────
  UNION ALL
  SELECT 'B1', 'CONFIRMED "Pay online" booking that is not PAID', b.id
    FROM "FacilityBooking" b WHERE b.status = 'CONFIRMED' AND b."paymentMethod" = 'ONLINE' AND b."paymentStatus" <> 'PAID'
  UNION ALL
  SELECT 'B2', 'COMPLETED "Pay online" booking that is not PAID', b.id
    FROM "FacilityBooking" b WHERE b.status = 'COMPLETED' AND b."paymentMethod" = 'ONLINE' AND b."paymentStatus" <> 'PAID'
  UNION ALL
  SELECT 'B3', 'CANCELLED booking holding paid money with no refund tracked (refund % > 0)', b.id
    FROM "FacilityBooking" b
   WHERE b.status = 'CANCELLED' AND b."paymentMethod" = 'ONLINE' AND b."paymentStatus" IN ('PAID','RECEIPT_SUBMITTED')
     AND b."refundStatus" = 'NONE' AND coalesce(b."refundPercent", 100) > 0 AND NOT b."isOpenMatch"
  UNION ALL
  SELECT 'B4', 'Refund NEEDED/PROCESSED on a booking that is not CANCELLED', b.id
    FROM "FacilityBooking" b WHERE b."refundStatus" <> 'NONE' AND b.status <> 'CANCELLED'
  UNION ALL
  SELECT 'B5', 'Refund PROCESSED but paymentStatus is not REFUNDED', b.id
    FROM "FacilityBooking" b WHERE b."refundStatus" = 'PROCESSED' AND b."paymentStatus" <> 'REFUNDED'
  UNION ALL
  SELECT 'B6', 'Receipt submitted/paid/rejected but no receipt file', b.id
    FROM "FacilityBooking" b WHERE b."paymentMethod" = 'ONLINE' AND b."paymentStatus" IN ('RECEIPT_SUBMITTED','REJECTED') AND b."receiptUrl" IS NULL AND NOT b."isOpenMatch"
  UNION ALL
  SELECT 'B7', 'Active booking whose slot has ended >2 days ago (never completed / no-showed)', b.id
    FROM "FacilityBooking" b, lk WHERE b.status IN ('PENDING','CONFIRMED') AND b."bookingDate"::date < lk.today - 2
  UNION ALL
  SELECT 'B8', 'Cancelled by player after the slot had started', b.id
    FROM "FacilityBooking" b
   WHERE b.status = 'CANCELLED' AND b."cancelledBy" = 'user'
     AND b."cancelledAt" > ((b."bookingDate"::date + b."startTime"::time) AT TIME ZONE 'Asia/Colombo')
  UNION ALL
  SELECT 'B9', 'Overlapping active bookings on the same court (double booking)', a.id
    FROM "FacilityBooking" a JOIN "FacilityBooking" c
      ON c."courtId" = a."courtId" AND c."bookingDate" = a."bookingDate" AND c.id > a.id
     AND c."startTime" < a."endTime" AND a."startTime" < c."endTime"
   WHERE a."courtId" IS NOT NULL AND a.status IN ('PENDING','CONFIRMED','COMPLETED') AND c.status IN ('PENDING','CONFIRMED','COMPLETED')

  -- ── No-shows ─────────────────────────────────────────────────────────
  UNION ALL
  SELECT 'N1', 'NO_SHOW booking with no review state (not in the admin queue properly)', b.id
    FROM "FacilityBooking" b WHERE b.status = 'NO_SHOW' AND b."noShowReview" IS NULL
  UNION ALL
  SELECT 'N2', 'No-show report that left NO_SHOW without an admin decision (owner flipped it)', b.id
    FROM "FacilityBooking" b WHERE b.status <> 'NO_SHOW' AND b."noShowReview" = 'PENDING'
  UNION ALL
  SELECT 'N3', 'User noShowCount differs from their counted no-shows (confirmed, or from before reviews)', u.id
    FROM "User" u
    LEFT JOIN (SELECT "userId", count(*) n FROM "FacilityBooking"
                WHERE status = 'NO_SHOW' AND ("noShowReview" = 'CONFIRMED' OR "noShowReview" IS NULL) GROUP BY 1) x ON x."userId" = u.id
   WHERE u."noShowCount" <> coalesce(x.n, 0)

  UNION ALL
  SELECT 'N4', 'No-show report undisputed for 3+ days but still pending (daily cron not confirming)', b.id
    FROM "FacilityBooking" b WHERE b.status = 'NO_SHOW' AND b."noShowReview" = 'PENDING' AND b."noShowDisputedAt" IS NULL AND b."noShowMarkedAt" < now() - interval '3 days'
  UNION ALL
  SELECT 'U7', 'Pending worker invitation for an account that is no longer a plain active player', i.id
    FROM "WorkerInvite" i JOIN "User" u ON u.id = i."userId" WHERE i.status = 'PENDING' AND (u.role <> 'USER' OR NOT u."isActive")

  -- ── Accounts and blocks ──────────────────────────────────────────────
  UNION ALL
  SELECT 'U1', 'User on the active blocklist (by user or email) but isActive = true', u.id
    FROM "User" u
   WHERE u."isActive" AND EXISTS (SELECT 1 FROM "AccountBlock" k WHERE k."liftedAt" IS NULL AND (k."userId" = u.id OR k.email = lower(u.email)))
  UNION ALL
  SELECT 'U2', 'Blocked user still holding a push token', u.id
    FROM "User" u WHERE NOT u."isActive" AND u."pushToken" IS NOT NULL
  UNION ALL
  SELECT 'U3', 'AccountBlock pointing at a user that no longer exists', k.id
    FROM "AccountBlock" k LEFT JOIN "User" u ON u.id = k."userId" WHERE k."userId" IS NOT NULL AND u.id IS NULL
  UNION ALL
  SELECT 'U4', 'Two active blocks for the same email', min(k.id)
    FROM "AccountBlock" k WHERE k."liftedAt" IS NULL GROUP BY k.email HAVING count(*) > 1
  UNION ALL
  SELECT 'U5', 'Emails differing only by letter case (login lookups are case-sensitive)', min(u.id)
    FROM "User" u GROUP BY lower(u.email) HAVING count(*) > 1
  UNION ALL
  SELECT 'U6', 'GROUND_WORKER with no FacilityWorker row (or worker row on a non-worker)', u.id
    FROM "User" u LEFT JOIN "FacilityWorker" w ON w."userId" = u.id
   WHERE (u.role = 'GROUND_WORKER') <> (w.id IS NOT NULL)

  -- ── Open-match lobbies ───────────────────────────────────────────────
  UNION ALL
  SELECT 'L1', 'MATCHED lobby with no booking, or matchBookingId pointing nowhere', m.id
    FROM "OpenMatch" m LEFT JOIN "FacilityBooking" b ON b.id = m."matchBookingId"
   WHERE (m.status = 'MATCHED' AND m."matchBookingId" IS NULL) OR (m."matchBookingId" IS NOT NULL AND b.id IS NULL)
  UNION ALL
  SELECT 'L2', 'COLLECTING lobby past its date or expiry (cron missed it)', m.id
    FROM "OpenMatch" m, lk WHERE m.status = 'COLLECTING' AND (m."expiresAt" < now() OR m."preferredDate"::date < lk.today)
  UNION ALL
  SELECT 'L3', 'COLLECTING lobby whose spotsReserved <> sum of live spot group sizes', m.id
    FROM "OpenMatch" m
    LEFT JOIN (SELECT "matchId", sum("groupSize") g FROM "OpenMatchSpot" WHERE status IN ('RESERVED','CONFIRMED') GROUP BY 1) s ON s."matchId" = m.id
   WHERE m.status = 'COLLECTING' AND m."spotsReserved" <> coalesce(s.g, 0)
  UNION ALL
  SELECT 'L4', 'GoPlay-collected MATCHED lobby with no LobbyPayout', m.id
    FROM "OpenMatch" m LEFT JOIN "LobbyPayout" p ON p."matchId" = m.id
   WHERE m.payee = 'PLATFORM' AND m.status = 'MATCHED' AND p.id IS NULL
  UNION ALL
  SELECT 'L5', 'LobbyPayout: amount <> court - commission, or collected < payout (GoPlay loses money)', p.id
    FROM "LobbyPayout" p
   WHERE abs(p."courtAmount" - p."commissionAmount" - p.amount) > 0.01 OR p."collectedAmount" < p.amount
  UNION ALL
  SELECT 'L6', 'LobbyPayout collectedAmount <> money on its CONFIRMED paid spots', p.id
    FROM "LobbyPayout" p
    LEFT JOIN (SELECT "matchId", sum("amountPaid") paid FROM "OpenMatchSpot" WHERE status = 'CONFIRMED' AND "paymentStatus" = 'PAID' GROUP BY 1) s ON s."matchId" = p."matchId"
   WHERE abs(p."collectedAmount" - coalesce(s.paid, 0)) > 0.01
  UNION ALL
  SELECT 'L7', 'Legacy spot: money paid but amountDue = 0 (refunds would compute Rs. 0)', s.id
    FROM "OpenMatchSpot" s WHERE s."amountPaid" > 0 AND s."amountDue" = 0
  UNION ALL
  SELECT 'L8', 'PAID spot whose amountPaid <> amountDue', s.id
    FROM "OpenMatchSpot" s WHERE s."paymentStatus" = 'PAID' AND s."amountDue" > 0 AND abs(s."amountPaid" - s."amountDue") > 0.01
  UNION ALL
  SELECT 'L9', 'Spot refund NEEDED/PROCESSED with no refund amount, or amount > what was due', s.id
    FROM "OpenMatchSpot" s WHERE s."refundStatus" <> 'NONE' AND (coalesce(s."refundAmount", 0) <= 0 OR s."refundAmount" > s."amountDue" + 0.01)
  UNION ALL
  SELECT 'L10', 'GoPlay refund NEEDED for 7+ days', s.id
    FROM "OpenMatchSpot" s WHERE s."refundStatus" = 'NEEDED' AND s."cancelledAt" < now() - interval '7 days'
  UNION ALL
  SELECT 'L11', 'LobbyPayout DUE for 7+ days after the game', p.id
    FROM "LobbyPayout" p JOIN "OpenMatch" m ON m.id = p."matchId", lk
   WHERE p.status = 'DUE' AND m."preferredDate"::date < lk.today - 7

  -- ── Complaints ───────────────────────────────────────────────────────
  UNION ALL
  SELECT 'C1', 'Complaint with neither or both of booking/spot', c.id
    FROM "PaymentComplaint" c WHERE (c."bookingId" IS NULL) = (c."spotId" IS NULL)
  UNION ALL
  SELECT 'C2', 'OPEN complaint whose payment is already PAID', c.id
    FROM "PaymentComplaint" c
    LEFT JOIN "FacilityBooking" b ON b.id = c."bookingId" LEFT JOIN "OpenMatchSpot" s ON s.id = c."spotId"
   WHERE c.status = 'OPEN' AND coalesce(b."paymentStatus", s."paymentStatus") = 'PAID'
)
SELECT id, what, count(*) AS violations, (array_agg(ref ORDER BY ref))[1:5] AS examples
  FROM checks GROUP BY id, what   -- a check that is not listed found nothing
ORDER BY 1;

-- Summary money figures to compare with the admin dashboard (Earnings page)
SELECT round(sum("platformFee")::numeric, 2)                                                   AS commission_total,
       round(sum("platformFee") FILTER (WHERE NOT "commissionPaid" AND "platformFee" > 0)::numeric, 2) AS commission_outstanding,
       (SELECT round(sum("collectedAmount" - amount)::numeric, 2) FROM "LobbyPayout" WHERE status <> 'CANCELLED') AS lobby_margin,
       (SELECT round(sum(amount)::numeric, 2) FROM "LobbyPayout" WHERE status = 'DUE')            AS payouts_due
  FROM "GroundEarning";

ROLLBACK;
