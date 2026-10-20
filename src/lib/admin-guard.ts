import { auth } from "@/lib/auth";

/** The signed-in admin, or null — for admin-only API routes. */
export async function requireAdmin() {
  const session = await auth();
  return session?.user?.role === "ADMIN" ? session.user : null;
}

export const forbidden = () => Response.json({ error: "Forbidden." }, { status: 403 });
