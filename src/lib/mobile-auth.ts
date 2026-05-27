import { SignJWT, jwtVerify } from "jose";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);

export interface MobileSession {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export async function signMobileToken(payload: MobileSession["user"]): Promise<string> {
  return new SignJWT({
    name:  payload.name,
    email: payload.email,
    role:  payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.id)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

async function fromBearer(req: NextRequest): Promise<MobileSession | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const { payload } = await jwtVerify(header.slice(7), secret);
    if (
      typeof payload.sub !== "string" ||
      typeof payload.role !== "string"
    ) return null;
    return {
      user: {
        id:    payload.sub,
        name:  (payload.name as string) ?? "",
        email: (payload.email as string) ?? "",
        role:  payload.role,
      },
    };
  } catch {
    return null;
  }
}

// Drop-in replacement for auth() that also accepts Bearer tokens.
// Routes swap `auth()` → `getSession(req)` and Bearer-authenticated
// mobile requests are handled transparently alongside existing cookie sessions.
export async function getSession(req: NextRequest): Promise<MobileSession | null> {
  const mobile = await fromBearer(req);
  if (mobile) return mobile;
  return auth() as Promise<MobileSession | null>;
}
