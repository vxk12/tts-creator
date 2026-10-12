import type { Metadata } from "next";
import Image from "next/image";
import { Nav } from "@/components/ui/Nav";
import { Footer } from "@/components/ui/Footer";
import { ButtonLink } from "@/components/ui/Button";
import unboxImg from "@/public/img/unbox.webp";

export const metadata: Metadata = {
  title: "Marketplace",
  description: "Bald: Samples von TikTok Shop Creatorn zu fairen Preisen kaufen.",
};

// shortcut: Platzhalter, bis der Marketplace (B2C) gebaut wird
export default function MarketplacePage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-4 pb-24 pt-12 sm:px-6 md:pt-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tighter sm:text-5xl md:text-6xl">Der Marketplace kommt bald</h1>
          <p className="mx-auto mt-5 max-w-[48ch] text-lg leading-relaxed text-fg-muted">
            Hier kaufst du bald Samples direkt von TikTok Shop Creatorn, neu oder kaum benutzt und zu fairen Preisen.
          </p>
          <div className="mt-9 flex justify-center">
            <ButtonLink href="/" size="lg">Zum Creator-Bereich</ButtonLink>
          </div>
        </div>
        <div className="relative mt-14 h-[44dvh] min-h-[260px] overflow-hidden rounded-card md:mt-20 md:h-[min(60dvh,560px)]">
          <Image src={unboxImg} alt="Hände packen ein Produkt aus" fill sizes="(min-width: 1280px) 1216px, 100vw" className="object-cover" placeholder="blur" />
        </div>
      </main>
      <Footer />
    </>
  );
}
