const userId   = process.env.NOTIFY_USER_ID;
const apiKey   = process.env.NOTIFY_API_KEY;
const senderId = process.env.NOTIFY_SENDER_ID;

/** Notify.lk wants the international form without "+": 94XXXXXXXXX (11 digits). */
function toNotifyFormat(phone: string): string | null {
  const local = normalizeToLocal(phone);
  return local ? "94" + local.slice(1) : null;
}

function normalizeToLocal(phone: string): string | null {
  const clean = phone.replace(/[\s\-\(\)]/g, "");

  // Already local format: 07XXXXXXXX
  if (clean.startsWith("0") && clean.length === 10) return clean;

  // International with +: +94XXXXXXXXX
  if (clean.startsWith("+94") && clean.length === 12) return "0" + clean.slice(3);

  // International without +: 94XXXXXXXXX
  if (clean.startsWith("94") && clean.length === 11) return "0" + clean.slice(2);

  // 9 digits, no prefix: 7XXXXXXXX
  if (clean.length === 9) return "0" + clean;

  return null;
}

/** Sends one SMS through Notify.lk. Resolves true only when Notify.lk accepted it —
 *  booking notices ignore the result, but phone OTPs must know a send failed. */
export async function sendSMS(to: string, message: string): Promise<boolean> {
  if (!userId || !apiKey || !senderId) {
    console.error("[SMS notify.lk] NOTIFY_USER_ID / NOTIFY_API_KEY / NOTIFY_SENDER_ID not set — SMS not sent");
    return false;
  }

  const intl = toNotifyFormat(to);
  if (!intl) return false;

  try {
    const url = `https://app.notify.lk/api/v1/send?user_id=${encodeURIComponent(userId)}&api_key=${encodeURIComponent(apiKey)}&service_id=${encodeURIComponent(senderId)}&to=${intl}&message=${encodeURIComponent(message)}`;
    const res  = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status === "error") {
      console.error("[SMS notify.lk]", data);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[SMS notify.lk]", err);
    return false;
  }
}
