import { redirect } from "next/navigation";

export default function WorkerRoot() {
  redirect("/worker/dashboard");
}
