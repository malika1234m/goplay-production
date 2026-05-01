"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  User, MapPin, Building2, DollarSign, Users, AlignLeft,
  Tag, CheckCircle, ChevronRight, ChevronLeft, Loader2,
  Phone, AlertCircle,
} from "lucide-react";

interface Category { id: string; name: string; icon: string | null }

const AMENITIES = ["Parking", "Changing Rooms", "Showers", "Floodlights", "Cafeteria", "WiFi", "Toilets", "First Aid", "Security"];

const STEPS = [
  { num: 1, label: "Personal Info" },
  { num: 2, label: "Facility Details" },
  { num: 3, label: "Review & Submit" },
];

export default function BecomeProviderPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [step,        setStep]       = useState(1);
  const [categories,  setCategories] = useState<Category[]>([]);
  const [submitting,  setSubmitting] = useState(false);
  const [submitted,   setSubmitted]  = useState(false);
  const [error,       setError]      = useState("");
  const [existing,    setExisting]   = useState<null | { status: string }>(null);
  const [checkingApp, setCheckingApp] = useState(true);

  const [form, setForm] = useState({
    phone: "", address: "", city: "",
    facilityName: "", facilityAddress: "", facilityCity: "",
    categoryId: "", proposedHourlyRate: "", capacity: "",
    amenities: [] as string[], facilityDescription: "",
  });

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then((d) => setCategories(d.categories ?? []));
    fetch("/api/provider/application").then((r) => r.json()).then((d) => {
      if (d.application) setExisting(d.application);
    }).finally(() => setCheckingApp(false));
  }, []);

  useEffect(() => {
    if (session?.user) setForm((f) => ({ ...f, phone: (session.user as any).phone ?? "" }));
  }, [session]);

  const toggleAmenity = (a: string) =>
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a],
    }));

  const validateStep = () => {
    if (step === 1) {
      if (!form.phone.trim())   { setError("Phone number is required."); return false; }
      if (!form.address.trim()) { setError("Address is required."); return false; }
      if (!form.city.trim())    { setError("City is required."); return false; }
    }
    if (step === 2) {
      if (!form.facilityName.trim())    { setError("Facility name is required."); return false; }
      if (!form.facilityAddress.trim()) { setError("Facility address is required."); return false; }
      if (!form.facilityCity.trim())    { setError("Facility city is required."); return false; }
      if (!form.categoryId)             { setError("Please select a sport category."); return false; }
      if (!form.proposedHourlyRate || Number(form.proposedHourlyRate) < 1) {
        setError("Please enter a valid hourly rate."); return false;
      }
    }
    setError("");
    return true;
  };

  const next = () => { if (validateStep()) setStep((s) => s + 1); };
  const back = () => { setError(""); setStep((s) => s - 1); };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    const res  = await fetch("/api/provider/apply", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        proposedHourlyRate: Number(form.proposedHourlyRate),
        capacity:           form.capacity ? Number(form.capacity) : undefined,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) { setError(data.error ?? "Submission failed."); return; }
    setSubmitted(true);
  };

  if (status === "loading" || checkingApp) {
    return <div className="flex items-center justify-center h-96 text-slate-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Loading…</span></div>;
  }

  if (!session) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">Sign in required</h2>
        <p className="text-slate-500 text-sm mb-6">You need to be logged in to apply as a provider.</p>
        <Link href="/login" className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors inline-block">Sign in</Link>
      </div>
    );
  }

  if (session.user.role === "GROUND_OWNER") {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">You're already a Ground Owner</h2>
        <p className="text-slate-500 text-sm mb-6">Access your dashboard to manage your grounds.</p>
        <Link href="/ground-owner/dashboard" className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors inline-block">Go to Dashboard</Link>
      </div>
    );
  }

  if (session.user.role === "ADMIN") {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">Not available for admins</h2>
      </div>
    );
  }

  // Show existing application status
  if (existing) {
    return (
      <div className="max-w-lg mx-auto py-12">
        <div className={`rounded-2xl border p-8 text-center ${
          existing.status === "PENDING"  ? "bg-amber-50 border-amber-200" :
          existing.status === "APPROVED" ? "bg-green-50 border-green-200" :
                                           "bg-red-50 border-red-200"
        }`}>
          {existing.status === "PENDING"  && <><Loader2 className="w-12 h-12 text-amber-500 mx-auto mb-4 animate-spin" /><h2 className="text-xl font-bold text-amber-900 mb-2">Application Under Review</h2><p className="text-amber-700 text-sm">Your application is being reviewed by our admin team. We'll notify you via SMS and in-app once it's processed.</p></>}
          {existing.status === "APPROVED" && <><CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" /><h2 className="text-xl font-bold text-green-900 mb-2">Application Approved!</h2><p className="text-green-700 text-sm mb-6">Your application has been approved. Please log out and log back in to access your Ground Owner dashboard.</p><Link href="/ground-owner/dashboard" className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors inline-block">Go to Dashboard</Link></>}
          {existing.status === "REJECTED" && <><AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" /><h2 className="text-xl font-bold text-red-900 mb-2">Application Not Approved</h2><p className="text-red-700 text-sm mb-6">Your previous application was not approved. You may submit a new application addressing the feedback.</p><button onClick={() => setExisting(null)} className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors">Apply Again</button></>}
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-3">Application Submitted!</h2>
        <p className="text-slate-500 text-sm mb-2 max-w-sm mx-auto">
          Your application to become a Ground Owner has been submitted. Our team will review it and get back to you.
        </p>
        <p className="text-xs text-slate-400 mb-8">You'll receive an SMS and in-app notification once reviewed.</p>
        <Link href="/dashboard" className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors inline-block">Back to Dashboard</Link>
      </div>
    );
  }

  const selectedCategory = categories.find((c) => c.id === form.categoryId);

  return (
    <div className="max-w-2xl mx-auto w-full flex flex-col gap-8 pb-8">

      {/* Header */}
      <div className="text-center pt-4">
        <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
          <Building2 className="w-3.5 h-3.5" /> Provider Application
        </div>
        <h1 className="text-3xl font-bold text-slate-900">Join as a Ground Owner</h1>
        <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">
          List your sports facility on GoPlay and start receiving bookings from players across Sri Lanka.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center px-2">
        {STEPS.map((s, i) => (
          <div key={s.num} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all ${
                step > s.num   ? "bg-green-600 text-white" :
                step === s.num ? "bg-green-600 text-white ring-4 ring-green-100" :
                                 "bg-slate-100 text-slate-400"
              }`}>
                {step > s.num ? <CheckCircle className="w-4 h-4" /> : s.num}
              </div>
              <span className={`text-xs font-medium hidden sm:block whitespace-nowrap ${
                step === s.num ? "text-green-700" : "text-slate-400"
              }`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-3 mb-4 transition-all ${step > s.num ? "bg-green-500" : "bg-slate-200"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-white rounded-2xl border border-slate-100 p-8 flex flex-col gap-5 shadow-sm">
        {/* ── Step 1: Personal Info ── */}
        {step === 1 && (
          <>
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-slate-400" />
              <h2 className="text-base font-semibold text-slate-900">Personal Information</h2>
            </div>
            <p className="text-xs text-slate-400 -mt-3">Confirm your contact and location details.</p>

            <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3 border border-slate-100">
              <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white font-bold shrink-0">
                {session.user.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{session.user.name}</p>
                <p className="text-xs text-slate-400">{session.user.email}</p>
              </div>
            </div>

            {[
              { label: "Phone Number", key: "phone", icon: Phone, placeholder: "+94 77 123 4567", type: "tel" },
              { label: "Your Address", key: "address", icon: MapPin, placeholder: "Your home or business address", type: "text" },
              { label: "City", key: "city", icon: MapPin, placeholder: "e.g. Colombo", type: "text" },
            ].map(({ label, key, icon: Icon, placeholder, type }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{label} <span className="text-red-400">*</span></label>
                <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-green-500 transition-all">
                  <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                  <input type={type} value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder} className="flex-1 text-sm outline-none bg-transparent placeholder:text-slate-400" />
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── Step 2: Facility Details ── */}
        {step === 2 && (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-slate-400" />
              <h2 className="text-base font-semibold text-slate-900">Facility Details</h2>
            </div>
            <p className="text-xs text-slate-400 -mt-3">Tell us about the sports ground you want to list.</p>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Facility Name <span className="text-red-400">*</span></label>
              <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-green-500 transition-all">
                <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                <input type="text" value={form.facilityName} onChange={(e) => setForm({ ...form, facilityName: e.target.value })}
                  placeholder="e.g. Colombo Cricket Academy" className="flex-1 text-sm outline-none bg-transparent placeholder:text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Sport Category <span className="text-red-400">*</span></label>
              <div className="relative">
                <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 bg-white">
                  <option value="">Select sport type</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Facility Address <span className="text-red-400">*</span></label>
              <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-green-500 transition-all">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <input type="text" value={form.facilityAddress} onChange={(e) => setForm({ ...form, facilityAddress: e.target.value })}
                  placeholder="Street address of the ground" className="flex-1 text-sm outline-none bg-transparent placeholder:text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Facility City <span className="text-red-400">*</span></label>
              <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-green-500 transition-all">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <input type="text" value={form.facilityCity} onChange={(e) => setForm({ ...form, facilityCity: e.target.value })}
                  placeholder="e.g. Colombo" className="flex-1 text-sm outline-none bg-transparent placeholder:text-slate-400" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Hourly Rate (Rs.) <span className="text-red-400">*</span></label>
                <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-green-500 transition-all">
                  <DollarSign className="w-4 h-4 text-slate-400 shrink-0" />
                  <input type="number" min={1} value={form.proposedHourlyRate} onChange={(e) => setForm({ ...form, proposedHourlyRate: e.target.value })}
                    placeholder="e.g. 2500" className="flex-1 text-sm outline-none bg-transparent placeholder:text-slate-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Capacity (Players)</label>
                <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-green-500 transition-all">
                  <Users className="w-4 h-4 text-slate-400 shrink-0" />
                  <input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                    placeholder="e.g. 22" className="flex-1 text-sm outline-none bg-transparent placeholder:text-slate-400" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Amenities</label>
              <div className="flex flex-wrap gap-2">
                {AMENITIES.map((a) => {
                  const on = form.amenities.includes(a);
                  return (
                    <button key={a} type="button" onClick={() => toggleAmenity(a)}
                      className={`px-3.5 py-2 text-xs font-medium rounded-xl border transition-colors ${on ? "bg-green-600 border-green-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-green-400 hover:text-green-600"}`}>
                      {a}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Description</label>
              <div className="flex gap-3 border border-slate-200 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-green-500 transition-all">
                <AlignLeft className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <textarea value={form.facilityDescription} onChange={(e) => setForm({ ...form, facilityDescription: e.target.value })}
                  placeholder="Describe your facility, rules, and what makes it special..." rows={3}
                  className="flex-1 text-sm outline-none bg-transparent placeholder:text-slate-400 resize-none" />
              </div>
            </div>
          </>
        )}

        {/* ── Step 3: Review ── */}
        {step === 3 && (
          <>
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-slate-400" />
              <h2 className="text-base font-semibold text-slate-900">Review Your Application</h2>
            </div>
            <p className="text-xs text-slate-400 -mt-3">Please review all details before submitting.</p>

            <div className="flex flex-col gap-4">
              {/* Personal */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Personal Information</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-slate-400">Name</p><p className="font-medium text-slate-900">{session.user.name}</p></div>
                  <div><p className="text-xs text-slate-400">Email</p><p className="font-medium text-slate-900">{session.user.email}</p></div>
                  <div><p className="text-xs text-slate-400">Phone</p><p className="font-medium text-slate-900">{form.phone}</p></div>
                  <div><p className="text-xs text-slate-400">City</p><p className="font-medium text-slate-900">{form.city}</p></div>
                  <div className="col-span-2"><p className="text-xs text-slate-400">Address</p><p className="font-medium text-slate-900">{form.address}</p></div>
                </div>
              </div>

              {/* Facility */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Facility Details</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="col-span-2"><p className="text-xs text-slate-400">Facility Name</p><p className="font-medium text-slate-900">{form.facilityName}</p></div>
                  <div><p className="text-xs text-slate-400">Sport</p><p className="font-medium text-slate-900">{selectedCategory?.icon} {selectedCategory?.name}</p></div>
                  <div><p className="text-xs text-slate-400">Hourly Rate</p><p className="font-medium text-slate-900">Rs. {Number(form.proposedHourlyRate).toLocaleString()}</p></div>
                  <div className="col-span-2"><p className="text-xs text-slate-400">Location</p><p className="font-medium text-slate-900">{form.facilityAddress}, {form.facilityCity}</p></div>
                  {form.capacity && <div><p className="text-xs text-slate-400">Capacity</p><p className="font-medium text-slate-900">{form.capacity} players</p></div>}
                  {form.amenities.length > 0 && (
                    <div className="col-span-2">
                      <p className="text-xs text-slate-400 mb-1">Amenities</p>
                      <div className="flex flex-wrap gap-1.5">
                        {form.amenities.map((a) => <span key={a} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-100">{a}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-700">
                After submission, our admin team will review your application. Once approved, you'll receive an SMS notification and your account will be upgraded to Ground Owner. Your facility will also be submitted for a separate listing review.
              </div>
            </div>
          </>
        )}

        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">{error}</p>}
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-3">
        {step > 1 ? (
          <button
            onClick={back}
            className="flex items-center gap-2 px-6 py-3 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        ) : (
          <div className="flex-1" />
        )}

        {step < 3 && (
          <button
            onClick={next}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        )}
        {step === 3 && (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
          >
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
              : <><CheckCircle className="w-4 h-4" /> Submit Application</>
            }
          </button>
        )}
      </div>
    </div>
  );
}
