"use client";

import Image from "next/image";
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ButtonLink } from "@/components/ui/Button";
import heroImg from "@/public/img/hero.webp";

const ease = [0.16, 1, 0.3, 1] as const;

export function Hero() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  // Leichte Tiefe: das Foto bleibt beim Scrollen etwas zurück
  const imgY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, 70]);

  const item = (i: number) =>
    reduce
      ? {}
      : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.8, delay: 0.08 * i, ease } };

  return (
    <section ref={ref} className="relative">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-10 sm:px-6 md:grid-cols-[1.05fr_1fr] md:gap-14 md:pb-24 md:pt-16 lg:px-8">
        <div>
          <motion.p {...item(0)} className="text-sm font-medium text-neon">
            Für TikTok Shop Creator
          </motion.p>
          <motion.h1 {...item(1)} className="mt-4 text-5xl font-semibold leading-[1.02] tracking-tighter sm:text-6xl lg:text-7xl">
            Samples in
            <br />
            Sekunden online.
          </motion.h1>
          <motion.p {...item(2)} className="mt-6 max-w-[34rem] text-lg leading-relaxed text-fg-muted">
            TikTok-Shop-Link an den Telegram-Bot schicken, Preis wählen, fertig. Oder direkt auf der Website hochladen.
          </motion.p>
          <motion.div {...item(3)} className="mt-9 flex flex-wrap gap-3">
            <ButtonLink href="/registrieren" size="lg">
              Registrieren
            </ButtonLink>
            <ButtonLink href="/#ablauf" variant="secondary" size="lg">
              So läuft&apos;s
            </ButtonLink>
          </motion.div>
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, ease }}
          className="relative h-[52dvh] min-h-[320px] overflow-hidden rounded-card md:h-[min(72dvh,640px)]"
        >
          <motion.div style={{ y: imgY }} className="absolute -inset-x-0 -top-10 bottom-[-40px]">
            <Image
              src={heroImg}
              alt="Creator nimmt im Studio ein Produktvideo auf"
              fill
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover object-[35%_center]"
              placeholder="blur"
            />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
