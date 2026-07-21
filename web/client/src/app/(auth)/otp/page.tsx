import { OtpForm } from "@/components/auth/otp-form";

export default async function OtpPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string }>;
}) {
  const { email, next } = await searchParams;
  return <OtpForm email={email ?? ""} next={next} />;
}
