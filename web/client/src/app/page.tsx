import { Navbar } from "@/components/aid/navbar";
import { Hero } from "@/components/aid/hero";
import { Roles } from "@/components/aid/roles";
import { HowItWorks } from "@/components/aid/how-it-works";
import { MobileCta } from "@/components/aid/mobile-cta";
import { Footer } from "@/components/aid/footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Roles />
        <HowItWorks />
        <MobileCta />
      </main>
      <Footer />
    </>
  );
}
