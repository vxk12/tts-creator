# TTS Creator-Plattform

Web-App für TikTok Shop Creator: registrieren (inkl. Steuer-Onboarding), Telegram verbinden, Samples per Bot hochladen.
Gebaut mit **Next.js 16, Tailwind CSS v4, Motion, Geist** und Phosphor-Icons. Dark-Mode mit einem Akzent (Neon-Grün `#00FF66`).

Der frühere statische Stand (Editorial-Design, Marktplatz) ist als Git-Tag `v1-editorial` gesichert.

| Bereich | Route | Zweck |
|---|---|---|
| Startseite | `/` | Ablauf, was nach Steuer zurückkommt, Preisrechner, FAQ |
| Registrierung | `/registrieren` | Shop-Creator-Check → TikTok-Username (Spalte B) → Grenzsteuersatz (Spalte C) → Creator-Key + „Mit Telegram verbinden“ |
| Dashboard: Samples | `/dashboard` | Samples verwalten: Filter, Suche, Preisstufe ändern, als verkauft markieren, Upload im Browser |
| Dashboard: Steuer | `/dashboard/steuer` | Jahresübersicht (Warenwert, Erlöse, zurück nach Steuer, Rechnungen), CSV-Export, Hinweise |
| | `/dashboard/steuer/rechnungen` | Rechnungen erstellen (fortlaufende Nummer, § 19 UStG oder 19 %/7 % USt), Drucken bzw. PDF |
| | `/dashboard/steuer/daten` | Grenzsteuersatz und Rechnungsdaten (Absender, Steuernummer, Kleinunternehmer) |
| Dashboard: Konto | `/dashboard/konto` | Telegram verbinden, Creator-Key, Abmelden |
| Telegram-Bot | `bot/` | Login mit Web-App-Zugangsdaten, Upload: TikTok-Shop-Link → Einkaufspreis → Preisstufe. Siehe [bot/README.md](bot/README.md) |
| Backend | `backend/Code.gs` | Google Apps Script als API zum Google Sheet |

Alte Adressen (`creator.html`, `dashboard.html`, …) werden per Redirect auf die neuen Routen weitergeleitet.

## Entwicklung

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # Produktions-Build
npm test           # Preislogik inkl. Abgleich mit dem Bot (bot/pricing.py)
```

## Preisberechnung (vorläufig)

**Steuersatz** (Status_Code, Spalte C): exakt in % oder geschätzt über das Einkommen (unter 12.300 € → 0.00, 15.000 bis 60.000 € → 0.30, über 66.000 € → 0.42). Jederzeit im Dashboard änderbar.

**Preisstufen:** Verkaufspreis = Einkaufspreis × Faktor (Fair 0,70 · Schnell 0,55 · Sofort weg 0,40)

**Zurück nach Steuer** (wird überall angezeigt) = Verkaufspreis + Steuervorteil = Einkaufspreis − echter Verlust.
Echter Verlust = (Einkaufspreis − Verkaufspreis) × (1 − Steuersatz). Beispiel 27 € bei 30 %: Fair 18,90 € → Verlust 5,67 € → zurück 21,33 € (79 %).

Die Logik steht an drei Stellen und muss gleich bleiben: `lib/pricing.ts`, `bot/pricing.py`, `backend/Code.gs` (CONFIG.TIERS + Formel in Spalte H). `npm test` prüft Website und Bot über 9.000 Fälle auf cent-genaue Gleichheit.

---

## Datenmodell (Google Sheet)

**Blatt `Tabellenblatt1` – Produkte**

| Spalte | Inhalt | Quelle |
|---|---|---|
| A | Produkt_ID | automatisch (UUID) |
| B | User_ID (TikTok-Username) | automatisch vom eingeloggten Creator |
| C | Status_Code (Steuersatz als Dezimalzahl) | automatisch vom eingeloggten Creator |
| D | Produkt_Name | optional im Dashboard |
| E | TTS_Shop_Link | Web-Maske Feld 1 |
| F | Einkaufspreis (= Streichpreis im Schaufenster) | Web-Maske Feld 2 |
| G | TikTok_Video_Link (= Video-Nachweis-Button) | optional |
| H | Empfohlener_Verkaufspreis (Formel = F × N) | Formel, wird automatisch gesetzt |
| I | Tax_Rate (gleicher Wert wie C) | automatisch |
| J | Kategorie (Tech / Beauty / Haushalt / Sonstiges) | optional im Dashboard |
| K | Erstellt_Am | automatisch |
| L | Beschreibung | optional / Beta-Katalog |
| M | Preisstufe (Fair / Schnell / Sofort weg) | Bot oder Dashboard |
| N | Preisfaktor (0.70 / 0.55 / 0.40) – Spalte H = F × N | automatisch |
| O | Quelle (Telegram / Web) | automatisch |
| P | Bild_URL | Beta-Katalog |
| Q | Shop_Preis (Preis im TikTok Shop, Streichpreis) | Beta-Katalog |

Im Schaufenster erscheinen alle Zeilen, deren Spalte H einen gültigen Preis enthält.

**Blatt `Creators`** (wird von `setup` automatisch angelegt)

| Spalte | Inhalt |
|---|---|
| A | Registriert_Am |
| B | User_ID (TikTok-Username) |
| C | Status_Code (0.00 / 0.30 / 0.42 oder exakter Satz, z. B. 0.35) |
| D | Telegram_Username (für den „Jetzt kaufen“-Button) |
| E | Creator_Key_Hash (SHA-256; der Key selbst wird nie gespeichert) |

**Formel in Spalte H** (in `backend/Code.gs` unter `CONFIG.PRICE_FORMULA` anpassbar):

```
=IF(OR(F="",N=""),"",ROUND(F*N,2))
```

---

## Einrichtung

### 1. Backend (Google Apps Script)

1. Google Sheet öffnen → **Erweiterungen → Apps Script**.
2. Den Inhalt von `backend/Code.gs` komplett einfügen und speichern.
3. Oben die Funktion **`setup`** auswählen → **Ausführen** → Berechtigungen bestätigen.
   Das legt die Blätter `Creators` und `Rechnungen` sowie fehlende Spaltenköpfe an.
4. **Bereitstellen → Neue Bereitstellung → Typ: Web-App**
   - Ausführen als: **Ich**
   - Zugriff: **Jeder**
5. Die **Web-App-URL** kopieren (endet auf `/exec`).

> Nach jeder Änderung an `Code.gs`: Code einfügen, **`setup` einmal ausführen**, dann **Bereitstellen → Bereitstellungen verwalten → Bearbeiten (Stift) → Version: Neue Version → Bereitstellen**. So bleibt die URL gleich. Eine *neue* Bereitstellung würde eine neue URL erzeugen.
>
> Rechnungen werden nie gelöscht (Aufbewahrungspflicht). Rechnungsdaten der Creator stehen als JSON in `Creators`, Spalte F.

### 2. Web-App mit dem Backend verbinden

In `lib/config.ts` die Web-App-URL eintragen (oder in Vercel die Umgebungsvariable `NEXT_PUBLIC_API_URL` setzen):

```ts
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://script.google.com/macros/s/XXXX/exec";
export const TELEGRAM_BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT ?? "ttsprojekt_bot";
```

Ohne API-URL läuft die Seite im **Demo-Modus**: Registrierungen und Samples werden nur im Browser gespeichert.

### 3. Hosting (Vercel)

Das Repo ist mit Vercel verbunden; jeder Push auf `main` wird automatisch gebaut. `vercel.json` setzt das Framework auf Next.js. Commits müssen vom GitHub-Account `vxk12` stammen (Vercel Hobby).

## Projektstruktur

```
app/                    Seiten (/, /registrieren, /dashboard), Layout, globale Styles
components/landing/     Hero, Ablauf (Bento), Zurück-Statement, Preisrechner, FAQ, CTA
components/onboarding/  Registrierungs-Assistent
components/dashboard/   Dashboard (Login, Telegram, Steuersatz, Samples, Upload)
components/pricing/     Steuersatz-Auswahl, Preisstufen, animierte Beträge
components/ui/          Navigation, Footer, Buttons, Hinweise
lib/                    Preislogik, API-Anbindung, Konfiguration
public/img/             Bilder (Unsplash-Lizenz), Beta-Produktbilder
tests/                  Tests der Preislogik
backend/Code.gs         Google Apps Script
bot/                    Telegram-Bot (Python)
```
