# TTS Deals – Telegram-Bot (Prototyp)

Über den Bot laden Creator ihre Samples hoch. Konto und Steuersatz kommen aus der Web-App.

## Ablauf

1. **Web-App:** registrieren (Steuersatz wird abgefragt), dann „Mit Telegram verbinden“
2. **Bot:** einmalig mit TikTok-Username + Creator-Key anmelden (die Nachricht mit dem Key löscht der Bot sofort). Ab dann kennt der Bot Konto und Steuersatz.
3. **Sample hochladen:** TikTok-Shop-Link schicken → Einkaufspreis eingeben (oder Shop-Preis übernehmen) → Preisstufe wählen → optional Video-Link → Vorschau → **„In meine Web-App hochladen“**

### Preisstufen (vorläufig)

| Stufe | Verkaufspreis |
|---|---|
| 🟢 Fair | 70 % vom Einkaufspreis |
| 🟡 Schnell | 55 % |
| 🔴 Sofort weg | 40 % |

Zu jeder Stufe zeigt der Bot, **was nach Steuer zurückkommt**:
`Verkaufspreis + Steuervorteil` = `Einkaufspreis − (Einkaufspreis − Verkaufspreis) × (1 − Steuersatz)`, Steuersatz aus der Web-App.

Die Stufen stehen an drei Stellen und müssen gleich bleiben: `bot/pricing.py`, `assets/js/api.js` (PRICING.TIERS), `backend/Code.gs` (TIERS).

### Beta: Produktdaten

Name, Bild, Beschreibung und Shop-Preis kommen noch nicht von TikTok Shop, sondern aus einem Beispielkatalog (`beta_catalog.py`). Gleicher Link = gleiches Beispielprodukt. Sobald die TikTok-Shop-Anbindung steht, wird nur `product_from_link()` ersetzt.

## Einrichten

1. **Bot anlegen:** In Telegram den Chat **@BotFather** öffnen → `/newbot` → Name und Username vergeben → Token kopieren.
2. **Konfiguration:** `bot/.env.example` nach `bot/.env` kopieren und den Token eintragen.
   - `API_URL` = Web-App-URL des Apps Script (siehe Haupt-README). Leer lassen = **Demo-Modus** mit Test-Konto `demo` / `demo-1234`.
3. **Bot-Username in der Web-App eintragen:** `assets/js/config.js` → `TELEGRAM_BOT` (ohne @), damit „Mit Telegram verbinden“ zum richtigen Bot führt.
4. **Starten:**

```bash
cd bot
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python main.py
```

Der Bot läuft, solange das Terminal offen ist (Polling). Für den Dauerbetrieb braucht er später einen kleinen Server – Vercel eignet sich für dauerhaft laufende Bots nicht.

## Befehle

| Befehl | Funktion |
|---|---|
| `/start` | Anmelden bzw. Hauptmenü |
| `/menu` | Hauptmenü |
| `/neu` | Sample hochladen (oder einfach einen Link schicken) |
| `/konto` | Konto & Steuersatz |
| `/abbrechen` | Aktuellen Vorgang abbrechen (jeder Schritt hat auch einen „Abbrechen“-Button) |
| `/abmelden` | Telegram vom Konto trennen (im Konto-Menü mit Bestätigung) |

## Tests

```bash
cd bot
.venv/bin/python -m unittest discover -s tests -v
```

Die Tests spielen den kompletten Chat-Ablauf gegen ein simuliertes Telegram durch – ohne Token und ohne Netzwerk.

## Dateien

```
main.py          Bot: Anmeldung, Sample-Flow, Konto
pricing.py       Preisstufen, zurück nach Steuer, Geldformat
beta_catalog.py  Beispiel-Produktdaten zu einem TikTok-Shop-Link
backend.py       Anbindung an die Web-App (Apps Script) bzw. Demo-Modus
storage.py       Verknüpfung Telegram-Nutzer ↔ Web-App-Konto (SQLite)
config.py        Einstellungen aus .env
tests/           Unit- und Ablauf-Tests
```
