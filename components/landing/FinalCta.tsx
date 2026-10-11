import Image from "next/image";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import creatorLive from "@/public/img/creator-live.webp";

export function FinalCta() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 md:pb-28 lg:px-8">
      <Reveal>
        <div className="relative flex min-h-[380px] items-end overflow-hidden rounded-card">
          <Image src={creatorLive} alt="Smartphone auf Stativ filmt einen Creator" fill sizes="100vw" className="object-cover object-[70%_center]" placeholder="blur" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950/95 via-ink-950/75 to-ink-950/20" />
          <div className="relative max-w-xl p-7 sm:p-12">
            <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">Bereit für dein erstes Sample?</h2>
            <p className="mt-4 max-w-[46ch] text-lg leading-relaxed text-fg-muted">
              Konto anlegen, Telegram verbinden und den ersten Link schicken.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/registrieren" size="lg">Registrieren</ButtonLink>
              <ButtonLink href="/dashboard" variant="secondary" size="lg">Login</ButtonLink>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
