import { Navbar } from "@/components/aid/navbar";
import { Hero } from "@/components/aid/hero";
import { Problem } from "@/components/aid/problem";
import { LandscapeChart } from "@/components/aid/landscape-chart";
import { HowItWorks } from "@/components/aid/how-it-works";
import { Apis } from "@/components/aid/apis";
import { Pilot } from "@/components/aid/pilot";
import { Footer } from "@/components/aid/footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Problem />
        <LandscapeChart />
        <HowItWorks />
        <Apis />
        <Pilot />
      </main>
      <Footer />
    </>
  );
}
