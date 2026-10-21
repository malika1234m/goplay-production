import { Prisma } from "@prisma/client";

// Money is stored as exact NUMERIC (no floating-point drift in sums), but every API response and
// every caller keeps getting plain numbers: this extension turns the exact values back into numbers
// on read. Aggregates (_sum, groupBy) aren't covered by Prisma extensions — wrap those in num().

const n  = (d: Prisma.Decimal) => d.toNumber();
const nn = (d: Prisma.Decimal | null) => (d === null ? null : d.toNumber());

/** A Decimal (or null) from an aggregate, as a number. */
export const num = (d: Prisma.Decimal | number | null | undefined): number =>
  d === null || d === undefined ? 0 : typeof d === "number" ? d : d.toNumber();

export const moneyAsNumbers = Prisma.defineExtension({
  name: "money-as-numbers",
  result: {
    groundOwnerProfile: {
      commissionRequestedAmount: { needs: { commissionRequestedAmount: true }, compute: (r) => nn(r.commissionRequestedAmount) },
    },
    sportsFacility: {
      hourlyRate:     { needs: { hourlyRate: true },     compute: (r) => n(r.hourlyRate) },
      commissionRate: { needs: { commissionRate: true }, compute: (r) => nn(r.commissionRate) },
    },
    facilityBooking: {
      totalAmount:  { needs: { totalAmount: true },  compute: (r) => n(r.totalAmount) },
      refundAmount: { needs: { refundAmount: true }, compute: (r) => nn(r.refundAmount) },
    },
    providerApplication: {
      proposedHourlyRate: { needs: { proposedHourlyRate: true }, compute: (r) => n(r.proposedHourlyRate) },
    },
    groundEarning: {
      grossAmount: { needs: { grossAmount: true }, compute: (r) => n(r.grossAmount) },
      platformFee: { needs: { platformFee: true }, compute: (r) => n(r.platformFee) },
      netAmount:   { needs: { netAmount: true },   compute: (r) => n(r.netAmount) },
    },
    openMatchSpot: {
      amountPaid:   { needs: { amountPaid: true },   compute: (r) => n(r.amountPaid) },
      amountDue:    { needs: { amountDue: true },    compute: (r) => n(r.amountDue) },
      refundAmount: { needs: { refundAmount: true }, compute: (r) => nn(r.refundAmount) },
    },
    lobbyPayout: {
      collectedAmount:  { needs: { collectedAmount: true },  compute: (r) => n(r.collectedAmount) },
      courtAmount:      { needs: { courtAmount: true },      compute: (r) => n(r.courtAmount) },
      commissionRate:   { needs: { commissionRate: true },   compute: (r) => n(r.commissionRate) },
      commissionAmount: { needs: { commissionAmount: true }, compute: (r) => n(r.commissionAmount) },
      amount:           { needs: { amount: true },           compute: (r) => n(r.amount) },
    },
  },
});
