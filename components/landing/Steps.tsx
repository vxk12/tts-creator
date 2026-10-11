import Image from "next/image";
import { TelegramLogo, UserPlus, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { Reveal } from "@/components/ui/Reveal";
import creatorHome from "@/public/img/creator-home.webp";
import earbuds from "@/public/img/beta/earbuds.jpg";

export function Steps() {
  return (
    <section id="ablauf" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28 lg:px-8">
      <Reveal className="max-w-2xl">
        <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">Von der Anmeldung zum Inserat</h2>
        <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-fg-muted">
          Die Web-App kennt dein Konto und deinen Steuersatz. Der Telegram-Bot nimmt deine Samples entgegen.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-4 md:grid-cols-12 md:grid-rows-2">
        <Reveal className="md:col-span-7 md:row-span-2">
          <article className="group relative flex h-full min-h-[440px] flex-col justify-end overflow-hidden rounded-card">
            <Image
              src={creatorHome}
              alt="Creatorin filmt sich zu Hause mit dem Smartphone"
              fill
              sizes="(min-width: 768px) 58vw, 100vw"
              className="object-cover transition-transform duration-700 ease-out-expo group-hover:scale-[1.03]"
              placeholder="blur"
            />
            <div className="scrim-b absolute inset-0" />
            <div className="relative p-7 sm:p-9">
              <UserPlus size={28} weight="regular" className="text-neon" aria-hidden="true" />
              <h3 className="mt-4 text-2xl font-semibold tracking-tight">Registrieren</h3>
              <p className="mt-2 max-w-md leading-relaxed text-fg-muted">
                Kurzer Check als TikTok Shop Creator, dein TikTok-Username und dein Steuersatz. Einmalig in der Web-App.
              </p>
            </div>
          </article>
        </Reveal>

        <Reveal className="md:col-span-5" delay={0.08}>
          <article className="flex h-full flex-col justify-between gap-10 rounded-card bg-neon p-7 text-neon-ink transition-transform duration-300 ease-out-expo hover:-translate-y-1 sm:p-9">
            <TelegramLogo size={40} weight="fill" aria-hidden="true" />
            <div>
              <h3 className="text-2xl font-semibold tracking-tight">Telegram verbinden</h3>
              <p className="mt-2 max-w-sm leading-relaxed text-neon-ink/80">
                Ein Tipp in der Web-App öffnet unseren Bot. Creator-Key schicken, fertig. Ab dann kennt er dein Konto.
              </p>
            </div>
          </article>
        </Reveal>

        <Reveal className="md:col-span-5" delay={0.16}>
          <article className="grid h-full grid-cols-[1fr_auto] overflow-hidden rounded-card border border-white/[0.07] bg-ink-900 transition-transform duration-300 ease-out-expo hover:-translate-y-1">
            <div className="flex flex-col justify-between gap-10 p-7 sm:p-9">
              <UploadSimple size={28} className="text-neon" aria-hidden="true" />
              <div>
                <h3 className="text-2xl font-semibold tracking-tight">Sample hochladen</h3>
                <p className="mt-2 leading-relaxed text-fg-muted">
                  TikTok-Shop-Link schicken, Einkaufspreis eingeben, Preisstufe wählen. Das Sample landet in deiner Web-App.
                </p>
              </div>
            </div>
            <div className="relative w-28 sm:w-40">
              <Image src={earbuds} alt="Kabellose Kopfhörer im Ladecase" fill sizes="160px" className="object-cover" placeholder="blur" />
            </div>
          </article>
        </Reveal>
      </div>
    </section>
  );
}
