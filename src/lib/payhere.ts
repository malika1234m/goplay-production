import crypto from "crypto";

export const PAYHERE_MERCHANT_ID     = process.env.PAYHERE_MERCHANT_ID     ?? "";
export const PAYHERE_MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET ?? "";
export const PAYHERE_SANDBOX         = process.env.PAYHERE_SANDBOX !== "false";

const PAYHERE_API_BASE = PAYHERE_SANDBOX
  ? "https://sandbox.payhere.lk/merchant/v1"
  : "https://www.payhere.lk/merchant/v1";

export const PAYHERE_CHECKOUT_URL = PAYHERE_SANDBOX
  ? "https://sandbox.payhere.lk/pay/checkout"
  : "https://www.payhere.lk/pay/checkout";

/**
 * Query PayHere's Merchant API to get the current status of a payment by order_id.
 * Returns status_code: 2=paid, 0=pending, -1=cancelled, -2=failed, -3=chargedback
 * Returns null if the order is not found or the API call fails.
 */
export async function queryPayHereStatus(orderId: string): Promise<{
  statusCode: number;
  amount:     string;
  currency:   string;
} | null> {
  try {
    // Step 1: get OAuth token
    const credentials = Buffer.from(`${PAYHERE_MERCHANT_ID}:${PAYHERE_MERCHANT_SECRET}`).toString("base64");
    const tokenRes = await fetch(`${PAYHERE_API_BASE}/oauth/token`, {
      method:  "POST",
      headers: { "Authorization": `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
      body:    "grant_type=client_credentials",
    });
    if (!tokenRes.ok) return null;
    const { access_token } = await tokenRes.json() as { access_token: string };
    if (!access_token) return null;

    // Step 2: query payment status
    const statusRes = await fetch(`${PAYHERE_API_BASE}/payment/search?order_id=${encodeURIComponent(orderId)}`, {
      headers: { "Authorization": `Bearer ${access_token}` },
    });
    if (!statusRes.ok) return null;

    const body = await statusRes.json() as {
      status: number;
      data?: { status_code: number; amount: string; currency: string }[];
    };

    if (body.status !== 1 || !body.data?.length) return null;
    const payment = body.data[0];
    return { statusCode: payment.status_code, amount: payment.amount, currency: payment.currency };
  } catch {
    return null;
  }
}

/**
 * Hash required by PayHere:
 * MD5( merchant_id + order_id + amount + currency + MD5(secret).toUpperCase() ).toUpperCase()
 */
export function buildPayHereHash(orderId: string, amount: number, currency = "LKR"): string {
  const secretHash  = crypto.createHash("md5").update(PAYHERE_MERCHANT_SECRET).digest("hex").toUpperCase();
  const amountStr   = amount.toFixed(2);
  const raw         = `${PAYHERE_MERCHANT_ID}${orderId}${amountStr}${currency}${secretHash}`;
  return crypto.createHash("md5").update(raw).digest("hex").toUpperCase();
}

/**
 * Verify the MD5 signature sent by PayHere in the notify callback.
 * PayHere sends: merchant_id, order_id, payhere_amount, payhere_currency, status_code, md5sig
 */
export function verifyPayHereNotify(params: {
  merchant_id:      string;
  order_id:         string;
  payhere_amount:   string;
  payhere_currency: string;
  status_code:      string;
  md5sig:           string;
}): boolean {
  const secretHash = crypto.createHash("md5").update(PAYHERE_MERCHANT_SECRET).digest("hex").toUpperCase();
  const raw = `${params.merchant_id}${params.order_id}${params.payhere_amount}${params.payhere_currency}${params.status_code}${secretHash}`;
  const expected = crypto.createHash("md5").update(raw).digest("hex").toUpperCase();
  return expected === params.md5sig.toUpperCase();
}
.md5sig.toUpperCase();
}
