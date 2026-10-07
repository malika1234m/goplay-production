import { Suspense } from "react";
import PaymentsReview from "@/components/payments/PaymentsReview";

export default function PaymentsPage() {
  return (
    <Suspense>
      <PaymentsReview />
    </Suspense>
  );
}
