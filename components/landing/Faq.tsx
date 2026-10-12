import { Plus } from "@phosphor-icons/react/dist/ssr";
import { Reveal } from "@/components/ui/Reveal";

const QA = [
  { q: "Wer kann mitmachen?", a: "Nur offizielle TikTok Shop Creator. Ohne Shop-Creator-Status ist keine Registrierung möglich." },
  {
    q: "Wie lade ich Samples hoch?",
    a: "Über unseren Telegram-Bot: TikTok-Shop-Link schicken, Einkaufspreis eingeben, einen der drei Preisvorschläge nehmen oder deinen eigenen Preis festlegen. Im Bot meldest du dich einmalig mit Username und Creator-Key an. Alternativ lädst du direkt im Dashboard hoch.",
  },
  {
    q: "Muss ich meinen Steuersatz angeben?",
    a: "Nein, das ist optional. Mit Steuersatz zeigen wir dir zusätzlich, was später über die Steuererklärung dazukommt. Eintragen kannst du ihn jederzeit im Dashboard.",
  },
  {
    q: "Was, wenn ich keine Steuererklärung mache?",
    a: "Dann bekommst du einfach den Verkaufspreis. Der Teil über die Steuer kommt nur mit der Steuererklärung. Wer mit TikTok Shop Geld verdient, muss in der Regel ohnehin eine abgeben.",
  },
  {
    q: "Was, wenn ich meinen Steuersatz nicht kenne?",
    a: "Dann schätzen wir ihn über dein Jahreseinkommen. Das ist ein Näherungswert. Den genauen Satz findest du in deinem letzten Steuerbescheid.",
  },
  {
    q: "Woher kommen Produktname und Bilder?",
    a: "Aus dem TikTok Shop. In der aktuellen Beta arbeiten wir noch mit Beispieldaten, bis die Anbindung steht.",
  },
  { q: "Ist das eine Steuerberatung?", a: "Nein. Alle Werte sind Schätzungen. Für verbindliche Auskünfte sprich mit deinem Steuerberater." },
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28 lg:px-8">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Reveal>
          <h2 className="text-4xl font-semibold tracking-tight md:text-5xl lg:sticky lg:top-24">Häufige Fragen</h2>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
            {QA.map((item) => (
              <details key={item.q} className="group">
                <summary className="flex cursor-pointer items-center justify-between gap-6 py-5 text-left text-lg font-medium text-fg transition-colors hover:text-neon">
                  {item.q}
                  <Plus size={20} className="shrink-0 text-fg-muted transition-transform duration-300 ease-out-expo group-open:rotate-45" aria-hidden="true" />
                </summary>
                <p className="max-w-[60ch] pb-6 leading-relaxed text-fg-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
