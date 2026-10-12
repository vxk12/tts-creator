import { Nav } from "@/components/ui/Nav";
import { Footer } from "@/components/ui/Footer";
import { Hero } from "@/components/landing/Hero";
import { Steps } from "@/components/landing/Steps";
import { PriceCalculator } from "@/components/landing/PriceCalculator";
import { Faq } from "@/components/landing/Faq";
import { FinalCta } from "@/components/landing/FinalCta";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Steps />
        <PriceCalculator />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
