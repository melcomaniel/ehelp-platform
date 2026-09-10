import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-[#e2e8f0] bg-white py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Image
            src="/brand/heart-egov.png"
            alt=""
            width={72}
            height={58}
            className="h-7 w-auto"
          />
          <p className="text-sm font-semibold text-[#1a1a2e]">EHelp</p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-[#64748b]">
          <Link href="/signin" className="hover:text-[#0040E7]">
            Staff sign in
          </Link>
          <a href="/get-app" download className="hover:text-[#0040E7]">
            Mobile app
          </a>
          <Link href="/signup" className="hover:text-[#0040E7]">
            Account access
          </Link>
        </div>
        <p className="text-xs text-[#94a3b8]">
          © {2026} Republic of the Philippines
        </p>
      </div>
    </footer>
  );
}
