import { redirect } from "next/navigation";

/** Create flow lives in the Programs sheet on /admin/programs. */
export default function CreateProgramRedirect() {
  redirect("/admin/programs");
}
