import { Prisma } from "@prisma/client";

export interface PaymentDetails {
  bankName:      string;
  bankBranch:    string | null;
  accountName:   string;
  accountNumber: string;
  instructions:  string | null;
}

/** Fields needed to work out where a player sends a "Pay online" transfer. */
export const paymentDetailsSelect = {
  paymentBankName:      true,
  paymentBankBranch:    true,
  paymentAccountName:   true,
  paymentAccountNumber: true,
  paymentInstructions:  true,
  owner: {
    select: { bankName: true, bankBranch: true, accountHolderName: true, accountNumber: true },
  },
} satisfies Prisma.SportsFacilitySelect;

type FacilityWithPaymentFields = Prisma.SportsFacilityGetPayload<{ select: typeof paymentDetailsSelect }>;

/**
 * The ground's own bank details win; otherwise the owner's profile details are used.
 * Returns null when neither is complete — "Pay online" is unavailable for that ground.
 */
export function resolvePaymentDetails(f: FacilityWithPaymentFields): PaymentDetails | null {
  if (f.paymentBankName && f.paymentAccountName && f.paymentAccountNumber) {
    return {
      bankName:      f.paymentBankName,
      bankBranch:    f.paymentBankBranch,
      accountName:   f.paymentAccountName,
      accountNumber: f.paymentAccountNumber,
      instructions:  f.paymentInstructions,
    };
  }
  const o = f.owner;
  if (o?.bankName && o.accountHolderName && o.accountNumber) {
    return {
      bankName:      o.bankName,
      bankBranch:    o.bankBranch,
      accountName:   o.accountHolderName,
      accountNumber: o.accountNumber,
      instructions:  f.paymentInstructions,
    };
  }
  return null;
}
