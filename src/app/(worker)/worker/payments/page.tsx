import { redirect } from "next/navigation";

// Receipts now live in the Bookings "Needs action" tab
export default function PaymentsPage() {
  redirect("/worker/bookings");
}
