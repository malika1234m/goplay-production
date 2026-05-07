import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM   = process.env.EMAIL_FROM ?? "GoPlay <noreply@goplay.lk>";

async function send(to: string, subject: string, html: string) {
  if (!resend) return; // silently skip if not configured
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error("[email]", err);
  }
}

// ── Shared layout ──────────────────────────────────────────────────────────
function layout(body: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;max-width:600px;width:100%">
      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#16a34a,#15803d);padding:28px 32px">
        <span style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.5px">⚽ GoPlay</span>
        <p style="color:#bbf7d0;margin:4px 0 0;font-size:13px">Sri Lanka's Sports Ground Booking Platform</p>
      </td></tr>
      <!-- Body -->
      <tr><td style="padding:32px">${body}</td></tr>
      <!-- Footer -->
      <tr><td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0">
        <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center">
          GoPlay · Sri Lanka &nbsp;|&nbsp; You received this because you have an account with us.<br>
          Questions? Reply to this email or visit <a href="https://goplay.lk/support" style="color:#16a34a">goplay.lk/support</a>
        </p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function infoRow(label: string, value: string) {
  return `<tr>
    <td style="padding:8px 0;color:#64748b;font-size:13px;width:140px">${label}</td>
    <td style="padding:8px 0;color:#0f172a;font-size:13px;font-weight:600">${value}</td>
  </tr>`;
}

function button(href: string, text: string) {
  return `<a href="${href}" style="display:inline-block;background:#16a34a;color:#fff;font-weight:600;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;margin-top:20px">${text}</a>`;
}

// ── 1. Welcome email ───────────────────────────────────────────────────────
export async function sendWelcomeEmail(to: string, name: string) {
  const html = layout(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px">Welcome to GoPlay, ${name}! 🎉</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px">
      Your account is ready. Start booking sports grounds near you in seconds —
      cricket, football, badminton, tennis and more.
    </p>
    ${button("https://goplay.lk/grounds", "Browse Grounds")}
    <p style="color:#94a3b8;font-size:12px;margin-top:20px">
      Need help? Visit our <a href="https://goplay.lk/support" style="color:#16a34a">support centre</a>.
    </p>
  `);
  await send(to, "Welcome to GoPlay! 🎉", html);
}

// ── 2. Booking received (to player) ───────────────────────────────────────
export async function sendBookingReceivedEmail(opts: {
  to: string; name: string; facilityName: string;
  date: string; startTime: string; endTime: string;
  totalAmount: number; paymentMethod: string; bookingId: string;
}) {
  const payLabel = opts.paymentMethod === "ONLINE" ? "Online (PayHere)" : "Cash on Arrival";
  const html = layout(`
    <h2 style="margin:0 0 4px;color:#0f172a;font-size:20px">Booking Request Received</h2>
    <p style="color:#475569;font-size:14px;margin:0 0 24px">
      Hi ${opts.name}, your booking is pending confirmation from the ground owner.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;padding:16px;border:1px solid #e2e8f0">
      ${infoRow("Ground", opts.facilityName)}
      ${infoRow("Date", opts.date)}
      ${infoRow("Time", `${opts.startTime} – ${opts.endTime}`)}
      ${infoRow("Amount", `Rs. ${opts.totalAmount.toLocaleString()}`)}
      ${infoRow("Payment", payLabel)}
      ${infoRow("Booking ID", opts.bookingId.slice(0, 8).toUpperCase())}
    </table>
    <p style="color:#64748b;font-size:13px;margin:16px 0 0">
      You'll get another email once the owner confirms. Check your bookings for updates.
    </p>
    ${button("https://goplay.lk/my-bookings", "View My Bookings")}
  `);
  await send(opts.to, `Booking Request — ${opts.facilityName}`, html);
}

// ── 3. New booking alert (to ground owner) ────────────────────────────────
export async function sendNewBookingAlertEmail(opts: {
  to: string; ownerName: string; playerName: string; facilityName: string;
  date: string; startTime: string; endTime: string;
  totalAmount: number; paymentMethod: string; bookingId: string;
}) {
  const payLabel = opts.paymentMethod === "ONLINE" ? "Paid Online via PayHere" : "Cash on Arrival";
  const html = layout(`
    <h2 style="margin:0 0 4px;color:#0f172a;font-size:20px">New Booking Request 🏟️</h2>
    <p style="color:#475569;font-size:14px;margin:0 0 24px">
      Hi ${opts.ownerName}, <strong>${opts.playerName}</strong> has requested a booking at <strong>${opts.facilityName}</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;padding:16px;border:1px solid #e2e8f0">
      ${infoRow("Player", opts.playerName)}
      ${infoRow("Date", opts.date)}
      ${infoRow("Time", `${opts.startTime} – ${opts.endTime}`)}
      ${infoRow("Amount", `Rs. ${opts.totalAmount.toLocaleString()}`)}
      ${infoRow("Payment", payLabel)}
      ${infoRow("Booking ID", opts.bookingId.slice(0, 8).toUpperCase())}
    </table>
    <p style="color:#64748b;font-size:13px;margin:16px 0 0">
      Please confirm or cancel this booking from your dashboard.
    </p>
    ${button("https://goplay.lk/ground-owner/bookings", "Manage Bookings")}
  `);
  await send(opts.to, `New Booking Request — ${opts.facilityName}`, html);
}

// ── 4. Booking confirmed (to player) ──────────────────────────────────────
export async function sendBookingConfirmedEmail(opts: {
  to: string; name: string; facilityName: string;
  date: string; startTime: string; endTime: string;
  totalAmount: number; paymentMethod: string; bookingId: string;
}) {
  const payNote = opts.paymentMethod === "ON_ARRIVAL"
    ? "Please bring <strong>Rs. " + opts.totalAmount.toLocaleString() + "</strong> in cash on the day."
    : "Payment has been received online. No further action needed.";
  const html = layout(`
    <div style="text-align:center;margin-bottom:24px">
      <div style="display:inline-block;background:#dcfce7;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:28px">✓</div>
    </div>
    <h2 style="margin:0 0 4px;color:#0f172a;font-size:20px;text-align:center">Booking Confirmed!</h2>
    <p style="color:#475569;font-size:14px;margin:0 0 24px;text-align:center">
      Your slot at <strong>${opts.facilityName}</strong> is confirmed.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:10px;padding:16px;border:1px solid #bbf7d0">
      ${infoRow("Ground", opts.facilityName)}
      ${infoRow("Date", opts.date)}
      ${infoRow("Time", `${opts.startTime} – ${opts.endTime}`)}
      ${infoRow("Amount", `Rs. ${opts.totalAmount.toLocaleString()}`)}
      ${infoRow("Booking ID", opts.bookingId.slice(0, 8).toUpperCase())}
    </table>
    <p style="color:#64748b;font-size:13px;margin:16px 0 0">${payNote}</p>
    ${button("https://goplay.lk/my-bookings", "View Booking")}
  `);
  await send(opts.to, `Booking Confirmed — ${opts.facilityName} on ${opts.date}`, html);
}

// ── 5. Password reset ─────────────────────────────────────────────────────
export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  const html = layout(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px">Reset Your Password</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 8px">
      Hi ${name}, we received a request to reset the password for your GoPlay account.
    </p>
    <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px">
      Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.
    </p>
    ${button(resetUrl, "Reset My Password")}
    <p style="color:#94a3b8;font-size:12px;margin-top:24px;line-height:1.6">
      If you didn't request this, you can safely ignore this email — your password will not change.<br>
      For security, this link can only be used once.
    </p>
  `);
  await send(to, "Reset your GoPlay password", html);
}

// ── 6. Booking cancelled (to player) ──────────────────────────────────────
export async function sendBookingCancelledEmail(opts: {
  to: string; name: string; facilityName: string;
  date: string; startTime: string; endTime: string;
  cancelledBy: "owner" | "player"; refundNeeded?: boolean;
}) {
  const reason = opts.cancelledBy === "owner"
    ? "The ground owner has cancelled this booking."
    : "You cancelled this booking.";
  const refundNote = opts.refundNeeded
    ? `<p style="color:#dc2626;font-size:13px;margin:12px 0 0;background:#fef2f2;padding:12px;border-radius:8px">
        💳 A refund will be processed within 5–7 business days. Our team will be in touch.
      </p>`
    : "";
  const html = layout(`
    <h2 style="margin:0 0 4px;color:#0f172a;font-size:20px">Booking Cancelled</h2>
    <p style="color:#475569;font-size:14px;margin:0 0 24px">${reason}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border-radius:10px;padding:16px;border:1px solid #fed7aa">
      ${infoRow("Ground", opts.facilityName)}
      ${infoRow("Date", opts.date)}
      ${infoRow("Time", `${opts.startTime} – ${opts.endTime}`)}
    </table>
    ${refundNote}
    ${button("https://goplay.lk/grounds", "Find Another Ground")}
  `);
  await send(opts.to, `Booking Cancelled — ${opts.facilityName}`, html);
}
