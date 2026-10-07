export interface PaymentDetails {
  bankName:      string;
  bankBranch:    string | null;
  accountName:   string;
  accountNumber: string;
  instructions:  string | null;
}

export type PaymentStatus = "PENDING" | "RECEIPT_SUBMITTED" | "REJECTED" | "PAID" | "FAILED" | "REFUNDED";

export interface Complaint {
  id:        string;
  status:    "OPEN" | "RESOLVED" | "DISMISSED";
  adminNote: string | null;
  createdAt: string;
}

export const isPdf = (url: string) => /\.pdf($|\?)/i.test(url) || url.includes("/raw/upload/");
