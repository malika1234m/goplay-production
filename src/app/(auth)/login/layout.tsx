import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { roleHome } from "@/lib/role-home";

// Already signed in: there's nothing to do here, so go straight to your own home page
export default async function SignedOutOnly({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (session?.user) redirect(roleHome(session.user.role, session.user.mustChangePassword));
  return children;
}
