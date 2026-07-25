import { redirect } from "next/navigation";

/** Citizens no longer use the web dashboard — send them to the mobile app CTA. */
export default function DashboardIndexRedirect() {
  redirect("/get-app");
}
