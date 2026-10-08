import { tk } from "./core";

/** Translation keys for enum values the API returns. Render with t(statusKey(s)). */
const STATUS: Record<string, string> = {
  PENDING:   tk("Pending"),
  CONFIRMED: tk("Confirmed"),
  COMPLETED: tk("Completed"),
  CANCELLED: tk("Cancelled"),
  NO_SHOW:   tk("No-show"),
  ACTIVE:    tk("Active"),
  INACTIVE:  tk("Inactive"),
  SUSPENDED: tk("Suspended"),
  REJECTED:  tk("Rejected"),
  APPROVED:  tk("Approved"),
  PAID:      tk("Paid"),
  REFUNDED:  tk("Refunded"),
  FAILED:    tk("Failed"),
  RECEIPT_SUBMITTED: tk("Receipt sent"),
};

export const statusKey = (s: string) => STATUS[s] ?? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
