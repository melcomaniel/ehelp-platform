import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignUpPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          One application profile for every aid program
        </p>
      </div>

      <form className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="first">First name</Label>
            <Input id="first" placeholder="Juan" autoComplete="given-name" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="last">Last name</Label>
            <Input id="last" placeholder="Dela Cruz" autoComplete="family-name" />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="mobile">Mobile number</Label>
          <Input
            id="mobile"
            type="tel"
            placeholder="+639090000000"
            autoComplete="tel"
          />
          <p className="text-xs text-muted-foreground">
            Status updates arrive by SMS — no smartphone needed after sign-up.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
        </div>

        <div className="rounded-lg border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
          Next step after sign-up: a one-time identity check against your
          PhilSys (National ID) record — so you only ever verify once.
        </div>

        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="mt-0.5 size-4 rounded border-input accent-[#0040E7]"
          />
          <span>
            I consent to identity verification against PhilSys and agree to the{" "}
            <Link href="#" className="text-[#0040E7] hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="#" className="text-[#0040E7] hover:underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        <Button
          size="lg"
          render={<Link href="/dashboard" />}
          className="w-full bg-[#0040E7] text-white hover:bg-[#0035c2]"
        >
          Create account
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button variant="outline" size="lg" className="w-full">
        Sign up with eGov SSO
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/signin" className="font-medium text-[#0040E7] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
