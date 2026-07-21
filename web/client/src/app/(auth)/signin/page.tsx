import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignInPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to check your applications and aid status
        </p>
      </div>

      <form className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">Email or mobile number</Label>
          <Input
            id="email"
            type="text"
            placeholder="you@example.com or +639…"
            autoComplete="username"
          />
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="#"
              className="text-xs text-[#0040E7] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>

        <Button
          size="lg"
          render={<Link href="/dashboard" />}
          className="w-full bg-[#0040E7] text-white hover:bg-[#0035c2]"
        >
          Sign in
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or continue with
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button variant="outline" size="lg" className="w-full">
        Sign in with eGov SSO
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        One login for every agency — DSWD, DOLE, OWWA and more.
      </p>

      <p className="text-center text-sm text-muted-foreground">
        First time applying for aid?{" "}
        <Link href="/signup" className="font-medium text-[#0040E7] hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
