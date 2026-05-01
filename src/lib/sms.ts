const userId   = process.env.NOTIFY_USER_ID;
const apiKey   = process.env.NOTIFY_API_KEY;
const senderId = process.env.NOTIFY_SENDER_ID;

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

export async function sendSMS(to: string, message: string): Promise<void> {
  if (!userId || !apiKey || !senderId) return;

  const local = normalizeToLocal(to);
  if (!local) return;

  try {
    const url = `https://app.notify.lk/api/v1/send?user_id=${encodeURIComponent(userId)}&api_key=${encodeURIComponent(apiKey)}&service_id=${encodeURIComponent(senderId)}&to=${local}&message=${encodeURIComponent(message)}`;
    const res  = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status === "error") {
      console.error("[SMS notify.lk]", data);
    }
  } catch (err) {
    console.error("[SMS notify.lk]", err);
  }
}
