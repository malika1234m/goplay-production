import type { PaymentOptions } from "@prisma/client";

// How a ground takes payment. Null means the owner hasn't chosen yet — treated as both,
// which is how every ground worked before the setting existed.

export const acceptsCash   = (o: PaymentOptions | null | undefined) => o !== "ONLINE_ONLY";
export const acceptsOnline = (o: PaymentOptions | null | undefined) => o !== "ON_ARRIVAL_ONLY";

export const PAYMENT_OPTION_LABEL: Record<PaymentOptions, string> = {
  ON_ARRIVAL_ONLY: "Pay at the ground only",
  ONLINE_ONLY:     "Online payment only",
  BOTH:            "Pay at the ground or online",
};

export function parsePaymentOptions(v: unknown): PaymentOptions | null | "invalid" {
  if (v === undefined || v === null || v === "") return null;
  return v === "ON_ARRIVAL_ONLY" || v === "ONLINE_ONLY" || v === "BOTH" ? v : "invalid";
}

/** What a player can actually use right now: online also needs a bank account on file. */
export function bookablePaymentMethods(o: PaymentOptions | null | undefined, hasAccount: boolean) {
  return { cash: acceptsCash(o), online: acceptsOnline(o) && hasAccount };
}
