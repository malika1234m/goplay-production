import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Where "Continue with Google" lands: send each role to its own home, like the login form does
export default async function ContinueAfterSignIn() {
  const session = await auth();
  const role    = session?.user?.role;
  if (!session?.user)                     redirect("/login");
  if (session.user.mustChangePassword)    redirect("/force-change-password");
  if (role === "ADMIN")                   redirect("/admin/dashboard");
  if (role === "GROUND_OWNER")            redirect("/ground-owner/dashboard");
  if (role === "GROUND_WORKER")           redirect("/worker/dashboard");
  redirect("/dashboard");
}
