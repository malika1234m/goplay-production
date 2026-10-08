"use client";

import { use, useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import PaymentCheckout from "@/components/payments/PaymentCheckout";
import type { Complaint, PaymentDetails, PaymentStatus } from "@/components/payments/types";
import { useT } from "@/i18n/I18nProvider";

interface LobbyPay {
  id:                 string;
  preferredDate:      string;
  preferredStartTime: string;
  preferredEndTime:   string;
  facility:           { name: string; address: string; city: string; images: string[] };
  category:           { name: string };
  court:              { name: string } | null;
  mySpot: {
    id: string; groupSize: number; status: string; paymentStatus: PaymentStatus; amountDue: number; createdAt: string;
    receiptUrl: string | null; receiptReviewedAt: string | null; receiptRejectReason: string | null;
    latestComplaint: Complaint | null; paymentDetails: PaymentDetails | null; receiptWindowMinutes: number | null;
  } | null;
}

export default function LobbyPayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [lobby, setLobby] = useState<LobbyPay | null>(null);
  const [error, setError] = useState("");
  const { t, tn } = useT();

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`/api/open-matches/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? t("We couldn't find this lobby.")); return; }
      setError("");
      setLobby(data);
    } catch {
      setError(t("You're offline. Reconnect and refresh the page."));
    }
  }, [id, t]);

  useEffect(() => { load(); }, [load]);

  if (error) return <p className="max-w-5xl mx-auto text-red-700">{t(error)}</p>;
  if (!lobby) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const spot = lobby.mySpot;
  if (!spot || !["RESERVED", "CONFIRMED"].includes(spot.status)) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <p className="text-lg font-semibold text-slate-900">{t("You don't have a spot in this lobby.")}</p>
        <a href={`/open-matches/${id}`} className="mt-4 inline-block text-pitch font-medium hover:underline">{t("Back to the lobby")}</a>
      </div>
    );
  }

  const windowMs = (spot.receiptWindowMinutes ?? 120) * 60_000;
  const deadline =
    spot.paymentStatus === "PENDING"  ? new Date(new Date(spot.createdAt).getTime() + windowMs) :
    spot.paymentStatus === "REJECTED" && spot.receiptReviewedAt ? new Date(new Date(spot.receiptReviewedAt).getTime() + windowMs) :
    null;

  return (
    <PaymentCheckout
      backHref={`/open-matches/${id}`}
      backLabel={t("Back to the lobby")}
      doneLabel={t("Go to the lobby")}
      groundName={lobby.facility.name}
      groundAddress={`${lobby.facility.address}, ${lobby.facility.city}`}
      image={lobby.facility.images[0] ?? null}
      date={lobby.preferredDate}
      startTime={lobby.preferredStartTime}
      endTime={lobby.preferredEndTime}
      detail={`${t("{sport} open match", { sport: t(lobby.category.name) })}${lobby.court ? `, ${lobby.court.name}` : ""} — ${tn(spot.groupSize, "{n} spot", "{n} spots")}`}
      amount={spot.amountDue}
      reference={spot.id.slice(0, 8).toUpperCase()}
      paymentStatus={spot.paymentStatus}
      deadline={deadline}
      details={spot.paymentDetails}
      receiptUrl={spot.receiptUrl}
      rejectReason={spot.receiptRejectReason}
      latestComplaint={spot.latestComplaint}
      uploadEndpoint={`/api/open-matches/${id}/receipt`}
      spotId={spot.id}
      onChanged={load}
    />
  );
}
