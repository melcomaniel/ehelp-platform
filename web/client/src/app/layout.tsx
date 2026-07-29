import type { Metadata, Viewport } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "EHelp Government Service Portal",
    template: "%s | EHelp Government Service Portal",
  },
  description:
    "Secure staff and administrator portal for Philippine government social assistance services.",
  applicationName: "EHelp",
  openGraph: {
    title: "EHelp Government Service Portal",
    description:
      "Secure staff and administrator portal for Philippine government social assistance services.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0040e7",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
