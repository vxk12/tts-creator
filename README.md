# TTS Creator-Plattform

Mobile-first Web-App (Deep Black + Neon-Grün `#00FF66`, Font Onest) im Editorial-Stil: Intro-Loader, Parallax-Hero, Clip-Masken-Reveals, Spring-Animationen, Smooth Scroll (Lenis).

**Aktueller Fokus: Creator-Workflow.** Web-App für Konto & Steuersatz, Telegram-Bot für den Sample-Upload. Der Marktplatz für Käufer ist vorbereitet, aber noch nicht verlinkt.

| Bereich | Datei | Zweck |
|---|---|---|
| **Creator-Startseite** | `index.html` | Workflow, interaktiver **Preisrechner** (Preisstufen + echter Verlust nach Steuer), FAQ |
| **Registrierung** | `creator.html` | Shop-Creator-Check → TikTok-Username (Spalte B) → Steuersatz (Spalte C) → Creator-Key → „Mit Telegram verbinden“ |
| **Dashboard** | `dashboard.html` | Telegram verbinden (inkl. Creator-Key), **Steuersatz ändern**, Samples im Web hochladen, Übersicht der Samples |
| **Telegram-Bot** | `bot/` | Login mit Web-App-Zugangsdaten, Upload: TikTok-Shop-Link → Einkaufspreis → Preisstufe → in die Web-App. Siehe [bot/README.md](bot/README.md) |
| *Marktplatz (versteckt)* | `marktplatz.html`, `shop.html`, `product.html` | B2C-Schaufenster, Suche & Produktseiten – fertig, aber nicht verlinkt (`noindex`) |

## Preisberechnung (vorläufig)

**Steuersatz** (Status_Code, Spalte C): exakt in % oder geschätzt über das Einkommen (unter 12.300 € → 0.00, 15.000–60.000 € → 0.30, über 66.000 € → 0.42). Jederzeit im Dashboard änderbar.

**Preisstufen:** Verkaufspreis = Einkaufspreis × Faktor

| Stufe | Faktor |
|---|---|
| Fair | 0,70 |
| Schnell | 0,55 |
| Sofort weg | 0,40 |

**Echter Verlust nach Steuer** = (Einkaufspreis − Verkaufspreis) × (1 − Steuersatz). Beispiel 27 € bei 30 %: Fair 18,90 € → Verlust 5,67 €.

Die Logik steht an drei Stellen und muss gleich bleiben: `assets/js/api.js` (PRICING), `bot/pricing.py`, `backend/Code.gs` (CONFIG.TIERS + Formel in Spalte H = F × N). Website und Bot rechnen cent-genau gleich (kaufmännisch gerundet).

Die Website ist rein statisch (HTML/CSS/JS, kein Build-Schritt). Als Datenbank dient das Google Sheet, angebunden über ein **Google Apps Script** (`backend/Code.gs`), das als kleine API läuft. Es gibt keinen eigenen Server und keine geheimen Schlüssel im Frontend.

Ohne eingetragene API-URL läuft die Seite im **Demo-Modus** mit Beispielprodukten. Registrierungen und Inserate werden dann nur im Browser gespeichert.

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
   Das legt das Blatt `Creators` und fehlende Spaltenköpfe (J–Q) an.
4. **Bereitstellen → Neue Bereitstellung → Typ: Web-App**
   - Ausführen als: **Ich**
   - Zugriff: **Jeder**
5. Die **Web-App-URL** kopieren (endet auf `/exec`).

> Nach jeder Änderung an `Code.gs`: **Bereitstellen → Bereitstellungen verwalten → Bearbeiten → Neue Version**. Sonst bleibt die alte Version aktiv.

### 2. Frontend konfigurieren

In `assets/js/config.js` eintragen:

```js
window.TTS_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/XXXX/exec',
  TELEGRAM_BOT: 'EuerBotName', // ohne @
};
```

### 3. Hosting

Die Website ist statisch und läuft auf jedem Hoster:

- **Vercel / Netlify:** Repository importieren. Framework „Other“, kein Build-Befehl, Ausgabeverzeichnis = Root.
- **GitHub Pages:** Repo → Settings → Pages → Branch `main`, Ordner `/ (root)`.
- **Lokal testen:** `python3 -m http.server 8080` → http://localhost:8080

---

## Ablauf

**Onboarding (Stufe 1)**
1. „Bist du offizieller TikTok Shop Creator?“ – bei NEIN wird die Nutzung sofort verweigert.
2. TikTok-Username → Spalte B.
3. „Kennst du deinen exakten Grenzsteuersatz?“
   - JA → Eingabe in % (35 → `0.35` in Spalte C)
   - NEIN → Unter 12.300 € = `0.00`, 15.000–60.000 € = `0.30`, über 66.000 € = `0.42`
4. Erfolgsseite mit „Mit Telegram verbinden“ und dem persönlichen **Creator-Key**, den man für den Web-Login braucht.

**Dashboard (Stufe 2)**
Login mit Username + Creator-Key. Die Maske hat drei Felder: Shop-Link (E), Einkaufspreis (F) und Video-Link (G). User_ID und Status_Code werden serverseitig ergänzt, die Formel in H berechnet sofort den Preis.

---

## Telegram-Anbindung

- **„Mit Telegram verbinden“** öffnet `https://t.me/<BOT>?start=<payload>`. `payload` ist der TikTok-Username als **Base64url** (Telegram erlaubt im Start-Parameter keine Punkte). Im Bot dekodieren, z. B. in Python: `base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)).decode()`.
- **„Jetzt kaufen“** führt in den privaten Chat des Creators (`https://t.me/<Telegram_Username>` aus Blatt `Creators`, Spalte D). Den Username trägt der Creator im Dashboard ein, oder euer Bot schreibt ihn in Spalte D. Ist keiner hinterlegt, landet der Käufer beim Bot mit `?start=kauf_<Produkt_ID>`.

## Projektstruktur

```
index.html              Creator-Startseite (Workflow, Preisrechner)
creator.html            Registrierung (Stufe 1)
dashboard.html          Creator-Dashboard (Stufe 2)
marktplatz.html         Marktplatz-Startseite (noch nicht verlinkt)
shop.html, product.html Suche & Produktseiten (noch nicht verlinkt)
assets/css/store.css    Design aller Seiten (rem-basiert, adaptiv skaliert)
assets/js/config.js     API-URL + Telegram-Bot
assets/js/api.js        API-Anbindung, Preislogik (PRICING), Demo-Modus
assets/js/core.js       Motion-Kern: Lenis, Spring-Animationen, Reveals, Parallax
assets/js/store.js      Header, Menü, Footer (Creator- & Shop-Variante), Produktkarten
assets/js/pricing-ui.js Steuersatz-Auswahl, animierte Preisanzeige, Aufschlüsselung
assets/js/creator-home.js, onboarding.js, dashboard.js
assets/js/home.js, shop-page.js, product.js   (Marktplatz)
assets/img/             Bilder (Unsplash-Lizenz) + Favicon
backend/Code.gs         Google Apps Script (API zum Google Sheet)
```

Die Kennzahlen auf der Startseite (Live-Deals, aktive Creator, Ø Ersparnis, Anteil mit Video-Nachweis) werden live aus den Produktdaten berechnet. Produktbilder kommen aus dem TikTok-Video (Vorschaubild); fehlt es, wird ein Kategorie-Bild angezeigt.
