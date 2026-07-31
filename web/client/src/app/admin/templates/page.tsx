import { redirect } from "next/navigation";

/** Templates ≡ Programs — keep a single Programs surface. */
export default function AdminTemplatesRedirect() {
  redirect("/admin/programs");
}
