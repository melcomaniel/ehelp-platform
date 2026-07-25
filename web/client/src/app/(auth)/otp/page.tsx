import { redirect } from "next/navigation";

/** OTP flow retired with Supabase Auth — use Nest sign-in. */
export default async function OtpPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const params = await searchParams;
  const q = params.email
    ? `?email=${encodeURIComponent(params.email)}`
    : "";
  redirect(`/signin${q}`);
}
