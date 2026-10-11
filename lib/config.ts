/**
 * Zentrale Einstellungen.
 *
 * API_URL:      Web-App-URL des Google Apps Script (endet auf /exec). Leer = Demo-Modus
 *               (Daten nur im Browser). Alternativ per NEXT_PUBLIC_API_URL setzen.
 * TELEGRAM_BOT: Username des Telegram-Bots ohne @.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
export const TELEGRAM_BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT ?? "ttsprojekt_bot";
export const DEMO = !API_URL;
