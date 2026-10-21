import { redirect } from "next/navigation";

// /admin on its own opens the dashboard
export default function AdminIndex() {
  redirect("/admin/dashboard");
}
