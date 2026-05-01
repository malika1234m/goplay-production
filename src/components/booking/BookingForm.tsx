"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Calendar, Phone, Clock, Loader2, CheckCircle, CreditCard, Banknote } from "lucide-react";

interface Slot { start: string; end: string; available: boolean; blocked?: boolean; blockReason?: string }
interface DaySchedule { dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string }

type PaymentMethod = "ON_ARRIVAL" | "ONLINE";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function firstOpenDate(availability: DaySchedule[]): string {
  const openDows = new Set(availability.filter((d) => d.isOpen).map((d) => d.dayOfWeek));
  if (openDows.size === 0) return new Date().toISOString().split("T")[0];
  const d = new Date();
  for (let i = 0; i < 14; i++) {
    if (openDows.has(d.getDay())) return d.toISOString().split("T")[0];
    d.setDate(d.getDate() + 1);
  }
  return new Date().toISOString().split("T")[0];
}

export default function BookingForm({
  facilityId,
  hourlyRate,
  availability = [],
}: {
  facilityId:   string;
  hourlyRate:   number;
  availability?: DaySchedule[];
}) {
  const { data: session } = useSession();
  const router = useRouter();

  const today = new Date().toISOString().split("T")[0];
  const [date,            setDate]            = useState(() => firstOpenDate(availability));
  const [duration,        setDuration]        = useState(1);
  const [selectedSlot,    setSelectedSlot]    = useState<string | null>(null);
  const [contactNumber,   setContactNumber]   = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [paymentMethod,   setPaymentMethod]   = useState<PaymentMethod>("ON_ARRIVAL");
  const [slots,           setSlots]           = useState<Slot[]>([]);
  const [loadingSlots,    setLoadingSlots]    = useState(false);
  const [submitting,      setSubmitting]      = useState(false);
  const [success,         setSuccess]         = useState(false);
  const [error,           setError]           = useState("");

  useEffect(() => {
    if (!date) return;
    setSelectedSlot(null);
    setLoadingSlots(true);
    fetch(`/api/grounds/${facilityId}/availability?date=${date}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [date, facilityId]);

  const toMins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const endTime = (start: string, hrs: number) => {
    const total = toMins(start) + hrs * 60;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };

  const canStart = (startTime: string): boolean => {
    const base = toMins(startTime);
    for (let i = 0; i < duration; i++) {
      const mins = base + i * 60;
      const t    = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
      const slot = slots.find((s) => s.start === t);
      if (!slot || !slot.available) return false;
    }
    return true;
  };

  const totalAmount = hourlyRate * duration;

  const selectedDow    = date ? new Date(date + "T00:00:00").getDay() : -1;
  const selectedSched  = availability.find((d) => d.dayOfWeek === selectedDow);
  const isClosedDay    = availability.length > 0 && (!selectedSched || !selectedSched.isOpen);
  const openDayNames   = availability.filter((d) => d.isOpen).map((d) => DAYS[d.dayOfWeek]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) { router.push("/login"); return; }
    if (!selectedSlot) { setError("Please select a time slot."); return; }
    if (!contactNumber.trim()) { setError("Contact number is required."); return; }

    setSubmitting(true);
    setError("");

    const res = await fetch("/api/bookings", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        facilityId,
        bookingDate:     date,
        startTime:       selectedSlot,
        endTime:         endTime(selectedSlot, duration),
        contactNumber:   contactNumber.trim(),
        specialRequests: specialRequests || undefined,
        paymentMethod,
      }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Booking failed. Please try again.");
      return;
    }

    if (paymentMethod === "ONLINE" && data.payHereParams) {
      // Submit a hidden form to PayHere
      const p = data.payHereParams;
      const form = document.createElement("form");
      form.method = "POST";
      form.action = p.checkout_url;

      const fields = [
        "merchant_id","return_url","cancel_url","notify_url",
        "order_id","items","currency","amount",
        "first_name","last_name","email","phone",
        "address","city","country","hash",
      ] as const;

      for (const key of fields) {
        const input    = document.createElement("input");
        input.type     = "hidden";
        input.name     = key;
        input.value    = String(p[key] ?? "");
        form.appendChild(input);
      }

      document.body.appendChild(form);
      form.submit();
      return;
    }

    // ON_ARRIVAL — show inline success
    setSuccess(true);
  };

  if (session?.user?.role === "GROUND_OWNER") {
    return (
      <div className="text-center py-10 px-4">
        <div className="text-5xl mb-4">🚫</div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">Booking not available</h3>
        <p className="text-sm text-slate-500">Ground owners cannot book sports grounds.</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-900 mb-1">Booking Received!</h3>
        <p className="text-sm text-slate-500 mb-1">
          Your booking is pending confirmation from the ground owner.
        </p>
        <p className="text-xs text-slate-400 mb-6">
          Pay <span className="font-semibold text-slate-600">Rs. {totalAmount.toLocaleString()}</span> on arrival.
        </p>
        <button
          onClick={() => router.push("/my-bookings")}
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          View My Bookings
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Date */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">Date</label>
        <div className="flex items-center gap-2 w-full px-4 py-3 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-green-500 transition">
          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="date"
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent w-full outline-none text-sm text-slate-900"
          />
        </div>
      </div>

      {/* Open days hint */}
      {openDayNames.length > 0 && (
        <p className="text-xs text-slate-400 -mt-2">
          Open: {openDayNames.join(", ")}
          {selectedSched?.isOpen && (
            <span className="text-green-600 font-medium ml-1">
              · {selectedSched.openTime}–{selectedSched.closeTime}
            </span>
          )}
        </p>
      )}

      {/* Duration */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">Duration</label>
        <select
          value={duration}
          onChange={(e) => { setDuration(Number(e.target.value)); setSelectedSlot(null); }}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-green-500 bg-white"
        >
          {[1, 2, 3, 4].map((h) => (
            <option key={h} value={h}>{h} {h === 1 ? "hour" : "hours"}</option>
          ))}
        </select>
      </div>

      {/* Time slots */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-2">
          Available Slots{selectedSlot && (
            <span className="text-green-600 ml-1">— {selectedSlot} to {endTime(selectedSlot, duration)}</span>
          )}
        </label>
        {loadingSlots ? (
          <div className="flex items-center justify-center py-6 text-slate-400 gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading slots...
          </div>
        ) : isClosedDay ? (
          <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-4 text-center">
            <p className="text-sm font-medium text-slate-600">Closed on {DAYS[selectedDow]}s</p>
            {openDayNames.length > 0 && (
              <p className="text-xs text-slate-400 mt-1">Available: {openDayNames.join(", ")}</p>
            )}
          </div>
        ) : slots.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">No slots available for this date.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {slots.map((slot) => {
              const slotMins   = toMins(slot.start);
              const isActive   = selectedSlot === slot.start;
              const isInRange  = selectedSlot !== null &&
                slotMins > toMins(selectedSlot) &&
                slotMins < toMins(selectedSlot) + duration * 60;
              const isBookable = slot.available && canStart(slot.start);

              if (slot.blocked) {
                return (
                  <div
                    key={slot.start}
                    title={slot.blockReason ? `Blocked: ${slot.blockReason}` : "Blocked for maintenance"}
                    className="text-xs text-center py-2 rounded-lg bg-red-50 text-red-400 cursor-not-allowed border border-red-100 font-medium"
                  >
                    {slot.start}
                    <span className="block text-[9px] text-red-300 leading-tight">blocked</span>
                  </div>
                );
              }

              if (!slot.available) {
                return (
                  <div key={slot.start} className="text-xs text-center py-2 rounded-lg bg-slate-50 text-slate-300 line-through cursor-not-allowed border border-slate-100">
                    {slot.start}
                  </div>
                );
              }
              if (!isBookable && !isInRange) {
                return (
                  <div key={slot.start} title={`Need ${duration}h consecutive`} className="text-xs text-center py-2 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed border border-slate-100">
                    {slot.start}
                  </div>
                );
              }
              return (
                <button
                  key={slot.start}
                  type="button"
                  onClick={() => { if (!isInRange) setSelectedSlot(isActive ? null : slot.start); }}
                  className={`text-xs text-center py-2 rounded-lg border font-medium transition-colors ${
                    isActive   ? "bg-green-600 border-green-600 text-white"
                    : isInRange ? "bg-green-100 border-green-300 text-green-700 cursor-default"
                    : "bg-white border-slate-200 text-slate-700 hover:border-green-400 hover:text-green-600"
                  }`}
                >
                  {slot.start}
                </button>
              );
            })}
          </div>
        )}

        {/* Legend */}
        {slots.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-2">
            <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="w-3 h-3 rounded bg-white border border-slate-200 inline-block" />Available
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="w-3 h-3 rounded bg-red-50 border border-red-100 inline-block" />Blocked
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="w-3 h-3 rounded bg-slate-50 border border-slate-100 inline-block" />Booked
            </span>
          </div>
        )}
      </div>

      {/* Contact */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          Contact Number <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-2 w-full px-4 py-3 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-green-500 transition">
          <Phone className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="tel"
            value={contactNumber}
            onChange={(e) => setContactNumber(e.target.value)}
            placeholder="+94 77 123 4567"
            required
            className="bg-transparent w-full outline-none text-sm text-slate-900 placeholder-slate-400"
          />
        </div>
        <p className="text-xs text-slate-400 mt-1">We'll send booking updates to this number via SMS.</p>
      </div>

      {/* Special requests */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          Special Requests <span className="text-slate-400">(optional)</span>
        </label>
        <textarea
          value={specialRequests}
          onChange={(e) => setSpecialRequests(e.target.value)}
          placeholder="Any special requirements..."
          rows={2}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-green-500 resize-none"
        />
      </div>

      {/* Payment method */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-2">Payment Method</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setPaymentMethod("ON_ARRIVAL")}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
              paymentMethod === "ON_ARRIVAL"
                ? "border-green-500 bg-green-50 text-green-700"
                : "border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            <Banknote className="w-4 h-4 shrink-0" />
            Pay on Arrival
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod("ONLINE")}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
              paymentMethod === "ONLINE"
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            Pay Online
          </button>
        </div>
        {paymentMethod === "ONLINE" && (
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            You will be redirected to PayHere to complete payment securely.
          </p>
        )}
        {paymentMethod === "ON_ARRIVAL" && (
          <p className="text-xs text-slate-400 mt-2">
            Pay in cash when you arrive at the ground.
          </p>
        )}
      </div>

      {/* Price summary */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
        <div className="flex justify-between text-sm text-slate-600 mb-1">
          <span>Rs. {hourlyRate.toLocaleString()} × {duration} {duration === 1 ? "hr" : "hrs"}</span>
          <span>Rs. {totalAmount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm font-semibold text-slate-900 pt-2 border-t border-slate-200 mt-2">
          <span>Total</span>
          <span className={paymentMethod === "ONLINE" ? "text-blue-600" : "text-green-600"}>
            Rs. {totalAmount.toLocaleString()}
          </span>
        </div>
        {paymentMethod === "ONLINE" && (
          <p className="text-xs text-blue-500 mt-1.5 text-right">Paid securely via PayHere</p>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting || !selectedSlot}
        className={`w-full disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 ${
          paymentMethod === "ONLINE"
            ? "bg-blue-600 hover:bg-blue-700"
            : "bg-green-600 hover:bg-green-700"
        }`}
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        {!session
          ? "Sign in to Book"
          : submitting
          ? "Processing..."
          : paymentMethod === "ONLINE"
          ? "Pay Online — Rs. " + totalAmount.toLocaleString()
          : "Confirm Booking"}
      </button>

      {paymentMethod === "ON_ARRIVAL" && (
        <p className="text-xs text-slate-400 text-center">Pending confirmation from the ground owner.</p>
      )}
    </form>
  );
}
