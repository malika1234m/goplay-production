import PaymentDetailsForm from "@/components/payments/PaymentDetailsForm";

export default function PaymentDetailsPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Payment Details</h1>
        <p className="text-slate-500 text-sm mt-1">
          Players who choose &quot;Pay online&quot; transfer straight to your bank account and upload the receipt for you to confirm.
          You can set a different account for any ground from its edit page.
        </p>
      </div>
      <PaymentDetailsForm mode="owner" />
    </div>
  );
}
