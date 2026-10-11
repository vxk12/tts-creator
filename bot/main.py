"""TTS Deals – Telegram-Bot (Prototyp).

Ablauf:
  1. /start (aus der Web-App: Deep-Link mit Username) → einmalig mit Creator-Key anmelden
  2. TikTok-Shop-Link schicken → Beta-Produktdaten
  3. Einkaufspreis → drei Preisstufen mit echtem Verlust nach Steuer
  4. optional Video-Link → fertige Listing-Vorschau → „In meine Web-App hochladen“

Start:  .venv/bin/python main.py
"""
from __future__ import annotations

import base64
import binascii
import html
import logging
import re
import warnings
from decimal import Decimal

from telegram import BotCommand, InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ParseMode
from telegram.error import TelegramError
from telegram.warnings import PTBUserWarning
from telegram.ext import (
    Application,
    ApplicationBuilder,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from backend import ApiBackend, Backend, BackendError, Credentials, DemoBackend, NewSample
from beta_catalog import Product, extract_link, is_tiktok_link, product_from_link
from config import DATA_DIR, Config, load_config
from pricing import TIER_BY_ID, TIERS, fmt_eur, fmt_rate, parse_money, real_loss, tier_price
from storage import Session, SessionStore

log = logging.getLogger("tts-bot")
# Buttons gehören bewusst zum Gesprächsverlauf, nicht zu einzelnen Nachrichten
warnings.filterwarnings("ignore", message=r".*per_message=False.*", category=PTBUserWarning)

USER_RE = re.compile(r"^[A-Za-z0-9._]{2,24}$")
LOGIN_USER, LOGIN_KEY, UP_LINK, UP_PRICE, UP_TIER, UP_VIDEO, UP_CONFIRM = range(7)
CONDITION = "Wie neu – nur 1x für Video ausgepackt"
DISCLAIMER = "Schätzung auf Basis deines Steuersatzes – keine Steuerberatung."
esc = html.escape


# ---------------------------------------------------------------------------
# Helfer
# ---------------------------------------------------------------------------
def cfg(ctx: ContextTypes.DEFAULT_TYPE) -> Config:
    return ctx.bot_data["config"]


def backend(ctx: ContextTypes.DEFAULT_TYPE) -> Backend:
    return ctx.bot_data["backend"]


def store(ctx: ContextTypes.DEFAULT_TYPE) -> SessionStore:
    return ctx.bot_data["store"]


async def say(update: Update, text: str, buttons: list[list[InlineKeyboardButton]] | None = None) -> None:
    await update.effective_chat.send_message(
        text, parse_mode=ParseMode.HTML, disable_web_page_preview=True,
        reply_markup=InlineKeyboardMarkup(buttons) if buttons else None,
    )


async def close_buttons(update: Update) -> None:
    """Buttons der angetippten Nachricht entfernen (verhindert Doppel-Klicks)."""
    if update.callback_query:
        try:
            await update.callback_query.answer()
        except TelegramError:
            pass
        try:
            await update.callback_query.edit_message_reply_markup(None)
        except TelegramError:
            pass


async def send_product_photo(update: Update, ctx: ContextTypes.DEFAULT_TYPE, product: Product, caption: str,
                             buttons: list[list[InlineKeyboardButton]] | None = None) -> None:
    cache: dict[str, str] = ctx.bot_data.setdefault("photo_ids", {})
    markup = InlineKeyboardMarkup(buttons) if buttons else None
    photo = cache.get(product.image)
    if photo is None and product.image_file.exists():
        photo = product.image_file.read_bytes()
    if photo is None:
        await say(update, caption, buttons)
        return
    msg = await update.effective_chat.send_photo(photo=photo, caption=caption, parse_mode=ParseMode.HTML, reply_markup=markup)
    if msg.photo:
        cache[product.image] = msg.photo[-1].file_id


def decode_payload(payload: str) -> str | None:
    """Deep-Link aus der Web-App: start=<Base64url(TikTok-Username)>."""
    if not payload:
        return None
    try:
        name = base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)).decode("utf-8")
    except (binascii.Error, UnicodeDecodeError, ValueError):
        return None
    return name if USER_RE.match(name) else None


CANCEL_ROW = [InlineKeyboardButton("✖️ Abbrechen", callback_data="flow:cancel")]
BACK_ROW = [InlineKeyboardButton("⬅️ Zurück zum Menü", callback_data="menu:main")]


async def show(update: Update, text: str, buttons: list[list[InlineKeyboardButton]] | None = None) -> None:
    """Menü-Ansichten: bei Button-Klick die Nachricht ersetzen statt eine neue zu schicken."""
    query = update.callback_query
    if query:
        try:
            await query.answer()
        except TelegramError:   # wurde schon beantwortet
            pass
        try:
            await query.edit_message_text(
                text, parse_mode=ParseMode.HTML, disable_web_page_preview=True,
                reply_markup=InlineKeyboardMarkup(buttons) if buttons else None,
            )
            return
        except TelegramError:
            try:   # z. B. Foto-Nachricht: Buttons entfernen, neue Nachricht senden
                await query.edit_message_reply_markup(None)
            except TelegramError:
                pass
    await say(update, text, buttons)


def menu_buttons(ctx: ContextTypes.DEFAULT_TYPE) -> list[list[InlineKeyboardButton]]:
    return [
        [InlineKeyboardButton("📦 Sample hochladen", callback_data="menu:upload")],
        [InlineKeyboardButton("👤 Mein Konto", callback_data="menu:account"),
         InlineKeyboardButton("🌐 Web-App", url=f"{cfg(ctx).web_app_url}/dashboard")],
    ]


async def require_session(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> Session | None:
    """Gespeicherte Anmeldung holen und Steuersatz frisch aus der Web-App laden."""
    tg_id = update.effective_user.id
    session = store(ctx).get(tg_id)
    if not session:
        await say(update, "🔐 Du bist noch nicht angemeldet. Tippe /start und melde dich mit deinen Web-App-Zugangsdaten an.")
        return None
    try:
        creator = await backend(ctx).login(Credentials(session.user_id, session.creator_key))
    except BackendError as exc:
        if "Login fehlgeschlagen" in str(exc):
            store(ctx).delete(tg_id)
            await say(update, "🔐 Deine Anmeldung ist nicht mehr gültig. Tippe /start und melde dich neu an.")
            return None
        await say(update, f"⚠️ {esc(str(exc))}")
        return None
    if creator.status_code != session.status_code:
        store(ctx).update_status(tg_id, creator.status_code)
    return Session(tg_id, session.user_id, session.creator_key, creator.status_code)


# ---------------------------------------------------------------------------
# Anmeldung
# ---------------------------------------------------------------------------
async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    payload = ctx.args[0] if ctx.args else ""
    if payload.startswith("kauf_"):
        await say(update, "👋 Hi! Dieser Bot ist für Creator. Den Kauf schließt du direkt im Chat mit dem Creator ab.")
        return ConversationHandler.END

    session = store(ctx).get(update.effective_user.id)
    if session:
        await say(update, f"Willkommen zurück, <b>@{esc(session.user_id)}</b>! 👋\n\nSchick mir einen TikTok-Shop-Link oder tippe auf „Sample hochladen“.", menu_buttons(ctx))
        return ConversationHandler.END

    demo = "\n\n🧪 <i>Demo-Modus: Test-Konto <code>demo</code> / <code>demo-1234</code></i>" if cfg(ctx).demo else ""
    intro = "👋 Willkommen bei <b>TTS Deals</b>!\n\nHier lädst du deine Samples hoch. Melde dich einmalig mit den Zugangsdaten aus der Web-App an."
    username = decode_payload(payload)
    if username:
        ctx.user_data["login_user"] = username
        await say(update, f"{intro}\n\n🔑 Schick mir jetzt deinen <b>Creator-Key</b> für <b>@{esc(username)}</b>.\n<i>Die Nachricht mit dem Key lösche ich sofort wieder.</i>{demo}", [CANCEL_ROW])
        return LOGIN_KEY
    await say(update, f"{intro}\n\n👤 Wie lautet dein <b>TikTok-Username</b>?\n\nNoch kein Konto? <a href=\"{cfg(ctx).web_app_url}/registrieren\">Hier registrieren</a>{demo}", [CANCEL_ROW])
    return LOGIN_USER


async def login_user(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    name = (update.message.text or "").strip().lstrip("@")
    if not USER_RE.match(name):
        await say(update, "Das ist kein gültiger TikTok-Username (2–24 Zeichen: Buchstaben, Zahlen, Punkt, Unterstrich). Versuch es noch einmal.")
        return LOGIN_USER
    ctx.user_data["login_user"] = name
    await say(update, f"🔑 Danke! Jetzt deinen <b>Creator-Key</b> für <b>@{esc(name)}</b> – du findest ihn auf der Erfolgsseite nach der Registrierung.\n<i>Die Nachricht lösche ich sofort wieder.</i>", [CANCEL_ROW])
    return LOGIN_KEY


async def login_key(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    key = (update.message.text or "").strip()
    try:
        await update.message.delete()   # Key nicht im Chatverlauf stehen lassen
    except TelegramError:
        pass
    user_id = ctx.user_data.get("login_user")
    if not user_id:
        return await start(update, ctx)

    try:
        creator = await backend(ctx).login(Credentials(user_id, key))
    except BackendError as exc:
        await say(update, f"❌ {esc(str(exc))}\n\nSchick mir den Creator-Key noch einmal – oder /start für einen anderen Username.", [CANCEL_ROW])
        return LOGIN_KEY

    store(ctx).save(update.effective_user.id, creator.user_id, key, creator.status_code)
    ctx.user_data.pop("login_user", None)
    tg_name = update.effective_user.username or ""
    if len(tg_name) >= 5 and tg_name.lower() != creator.telegram.lower():
        try:   # Telegram-Username fürs „Jetzt kaufen“ der Käufer hinterlegen
            await backend(ctx).update_telegram(Credentials(creator.user_id, key), tg_name)
        except BackendError:
            pass

    await say(
        update,
        f"✅ <b>Verbunden!</b> Dein Konto <b>@{esc(creator.user_id)}</b> ist jetzt mit Telegram verknüpft.\n\n"
        f"🧾 Steuersatz aus deiner Web-App: <b>{fmt_rate(creator.status_code)}</b>\n\n"
        "Schick mir einfach einen TikTok-Shop-Link, um ein Sample hochzuladen.",
        menu_buttons(ctx),
    )
    return ConversationHandler.END


# ---------------------------------------------------------------------------
# Sample hochladen
# ---------------------------------------------------------------------------
async def upload_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    await close_buttons(update)
    session = await require_session(update, ctx)
    if not session:
        return ConversationHandler.END
    ctx.user_data["draft"] = {"session": session}
    await say(update, "📦 <b>Neues Sample</b>\n\nSchick mir den <b>TikTok-Shop-Link</b> des Produkts.", [CANCEL_ROW])
    return UP_LINK


async def link_entry(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    """Link direkt in den Chat geschickt, ohne vorher /neu zu tippen."""
    session = await require_session(update, ctx)
    if not session:
        return ConversationHandler.END
    ctx.user_data["draft"] = {"session": session}
    return await up_link(update, ctx)


async def up_link(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    link = extract_link(update.message.text or "")
    if not link:
        await say(update, "Das sieht nicht nach einem Link aus. Schick mir den TikTok-Shop-Link (https://…).", [CANCEL_ROW])
        return UP_LINK
    if not is_tiktok_link(link):
        await say(update, "Bitte einen Link von TikTok Shop schicken (tiktok.com).", [CANCEL_ROW])
        return UP_LINK

    product = product_from_link(link)
    draft = ctx.user_data["draft"]
    draft.update(link=link, product=product)
    await send_product_photo(
        update, ctx, product,
        f"🛍 <b>{esc(product.name)}</b>\n{esc(product.description)}\n\n"
        f"Preis im TikTok Shop: <b>{fmt_eur(product.shop_price)}</b>\n\n"
        "🧪 <i>Beta: Produktdaten sind Beispieldaten, bis die TikTok-Shop-Anbindung steht.</i>",
    )
    await say(
        update,
        "💶 Was hast du für das Sample <b>bezahlt</b>?\nSchick mir den Einkaufspreis als Zahl, z. B. <code>27,90</code>.",
        [[InlineKeyboardButton(f"Shop-Preis übernehmen · {fmt_eur(product.shop_price)}", callback_data="price:shop")], CANCEL_ROW],
    )
    return UP_PRICE


async def up_price(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    purchase = parse_money(update.message.text or "")
    if purchase is None:
        await say(update, "Bitte nur eine positive Zahl schicken, z. B. <code>27,90</code>.", [CANCEL_ROW])
        return UP_PRICE
    ctx.user_data["draft"]["purchase"] = purchase
    return await show_tiers(update, ctx)


async def up_price_shop(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    await close_buttons(update)
    draft = ctx.user_data["draft"]
    draft["purchase"] = draft["product"].shop_price
    return await show_tiers(update, ctx)


async def show_tiers(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    draft = ctx.user_data["draft"]
    purchase: Decimal = draft["purchase"]
    rate: Decimal = draft["session"].status_code
    lines = [
        f"💶 Einkaufspreis: <b>{fmt_eur(purchase)}</b>",
        f"🧾 Dein Steuersatz: <b>{fmt_rate(rate)}</b> (aus deiner Web-App)",
        "",
    ]
    buttons = []
    for tier in TIERS:
        price = tier_price(purchase, tier)
        loss = real_loss(purchase, price, rate)
        lines.append(f"{tier.emoji} <b>{tier.label}</b> ({int(tier.factor * 100)} %) – <b>{fmt_eur(price)}</b>\n      echter Verlust nach Steuer: {fmt_eur(loss)}")
        buttons.append([InlineKeyboardButton(f"{tier.emoji} {tier.label} · {fmt_eur(price)}", callback_data=f"tier:{tier.id}")])
    lines += [
        "",
        "<i>Echter Verlust = (Einkaufspreis − Verkaufspreis) × (1 − Steuersatz).</i>",
        f"<i>{DISCLAIMER}</i>",
        "",
        "Welche Preisstufe nimmst du?",
    ]
    await say(update, "\n".join(lines), buttons + [CANCEL_ROW])
    return UP_TIER


async def up_tier(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    await close_buttons(update)
    tier_id = update.callback_query.data.split(":", 1)[1]
    if tier_id not in TIER_BY_ID:
        return UP_TIER
    draft = ctx.user_data["draft"]
    draft["tier"] = tier_id
    if "video" in draft:            # „Preisstufe ändern“ aus der Vorschau
        return await show_preview(update, ctx)
    await say(
        update,
        "🎬 Hast du ein <b>TikTok-Testvideo</b> zu dem Produkt? Schick mir den Link – das ist dein Video-Nachweis für Käufer.",
        [[InlineKeyboardButton("Überspringen", callback_data="video:skip"), CANCEL_ROW[0]]],
    )
    return UP_VIDEO


async def up_video(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    link = extract_link(update.message.text or "")
    if not link or not is_tiktok_link(link):
        await say(update, "Bitte einen TikTok-Video-Link schicken – oder auf „Überspringen“ tippen.",
                  [[InlineKeyboardButton("Überspringen", callback_data="video:skip"), CANCEL_ROW[0]]])
        return UP_VIDEO
    ctx.user_data["draft"]["video"] = link
    return await show_preview(update, ctx)


async def up_video_skip(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    await close_buttons(update)
    ctx.user_data["draft"]["video"] = ""
    return await show_preview(update, ctx)


async def show_preview(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    draft = ctx.user_data["draft"]
    product: Product = draft["product"]
    session: Session = draft["session"]
    tier = TIER_BY_ID[draft["tier"]]
    price = tier_price(draft["purchase"], tier)
    loss = real_loss(draft["purchase"], price, session.status_code)
    video = f'<a href="{esc(draft["video"])}">ansehen</a>' if draft["video"] else "folgt"
    caption = (
        "📝 <b>Deine Anzeige</b>\n\n"
        f"<b>{esc(product.name)}</b>\n"
        f"💶 <b>{fmt_eur(price)}</b> statt <s>{fmt_eur(product.shop_price)}</s> · Stufe {tier.label}\n"
        f"✨ Zustand: {CONDITION}\n"
        f"🎬 Video-Nachweis: {video}\n"
        f"👤 von @{esc(session.user_id)}\n\n"
        f"📉 Dein echter Verlust nach Steuer: <b>{fmt_eur(loss)}</b>"
    )
    await send_product_photo(update, ctx, product, caption, [
        [InlineKeyboardButton("✅ In meine Web-App hochladen", callback_data="confirm:upload")],
        [InlineKeyboardButton("💶 Preisstufe ändern", callback_data="confirm:tier"),
         InlineKeyboardButton("❌ Verwerfen", callback_data="confirm:discard")],
    ])
    return UP_CONFIRM


async def up_confirm(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    await close_buttons(update)
    action = update.callback_query.data.split(":", 1)[1]
    draft = ctx.user_data.get("draft") or {}
    if action == "tier":
        return await show_tiers(update, ctx)
    if action == "discard" or not draft:
        ctx.user_data.pop("draft", None)
        await say(update, "🗑 Verworfen.", menu_buttons(ctx))
        return ConversationHandler.END

    product: Product = draft["product"]
    session: Session = draft["session"]
    sample = NewSample(
        shop_link=draft["link"], purchase=draft["purchase"], tier=draft["tier"], video_link=draft["video"],
        name=product.name, description=product.description, category=product.category,
        image=product.image, shop_price=product.shop_price,
    )
    try:
        result = await backend(ctx).add_sample(Credentials(session.user_id, session.creator_key), sample)
    except BackendError as exc:
        await say(update, f"⚠️ Hochladen fehlgeschlagen: {esc(str(exc))}",
                  [[InlineKeyboardButton("🔁 Nochmal versuchen", callback_data="confirm:upload")]])
        return UP_CONFIRM

    ctx.user_data.pop("draft", None)
    price = result.get("price")
    price_txt = fmt_eur(Decimal(str(price))) if price is not None else fmt_eur(tier_price(sample.purchase, TIER_BY_ID[sample.tier]))
    await say(
        update,
        f"🎉 <b>Hochgeladen!</b>\n\n<b>{esc(product.name)}</b> für <b>{price_txt}</b> ist jetzt in deinem Web-App-Konto.",
        [[InlineKeyboardButton("🌐 Im Dashboard ansehen", url=f"{cfg(ctx).web_app_url}/dashboard")],
         [InlineKeyboardButton("📦 Nächstes Sample", callback_data="menu:upload")], BACK_ROW],
    )
    return ConversationHandler.END


async def cancel(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    ctx.user_data.pop("draft", None)
    ctx.user_data.pop("login_user", None)
    await close_buttons(update)
    if store(ctx).get(update.effective_user.id):
        await say(update, "✖️ Abgebrochen. Was möchtest du tun?", menu_buttons(ctx))
    else:
        await say(update, "✖️ Abgebrochen. Mit /start kannst du jederzeit neu beginnen.")
    return ConversationHandler.END


# ---------------------------------------------------------------------------
# Menü, Konto & Sonstiges
# ---------------------------------------------------------------------------
async def main_menu(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    session = store(ctx).get(update.effective_user.id)
    if not session:
        await show(update, "🔐 Du bist nicht angemeldet. Tippe /start, um dich mit deinem Web-App-Konto anzumelden.")
        return
    await show(update, f"📋 <b>Menü</b> · @{esc(session.user_id)}\n\nSchick mir einen TikTok-Shop-Link oder wähle eine Option.", menu_buttons(ctx))


async def account(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    if update.callback_query:
        try:
            await update.callback_query.answer()
        except TelegramError:
            pass
    session = await require_session(update, ctx)
    if not session:
        return
    await show(
        update,
        f"👤 <b>Dein Konto</b>\n\nTikTok: <b>@{esc(session.user_id)}</b>\n"
        f"Steuersatz: <b>{fmt_rate(session.status_code)}</b>\n\n"
        "Den Steuersatz änderst du in der Web-App – der Bot übernimmt ihn automatisch.",
        [[InlineKeyboardButton("🌐 Steuersatz in der Web-App ändern", url=f"{cfg(ctx).web_app_url}/dashboard")],
         [InlineKeyboardButton("🚪 Abmelden", callback_data="menu:logout_ask")],
         BACK_ROW],
    )


async def logout_ask(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    session = store(ctx).get(update.effective_user.id)
    if not session:
        await main_menu(update, ctx)
        return
    await show(
        update,
        f"🚪 Telegram wirklich von <b>@{esc(session.user_id)}</b> trennen?\n\nDu kannst dich jederzeit mit /start wieder anmelden.",
        [[InlineKeyboardButton("Ja, abmelden", callback_data="menu:logout"),
          InlineKeyboardButton("⬅️ Zurück", callback_data="menu:account")]],
    )


async def logout(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    store(ctx).delete(update.effective_user.id)
    ctx.user_data.clear()
    await show(update, "🚪 Abgemeldet. Mit /start meldest du dich wieder an.")


async def menu_from_flow(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    """Menü-Button während eines laufenden Uploads: Upload sauber beenden, dann Menü/Konto zeigen."""
    ctx.user_data.pop("draft", None)
    if update.callback_query.data == "menu:account":
        await account(update, ctx)
    else:
        await main_menu(update, ctx)
    return ConversationHandler.END


async def help_cmd(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    await say(
        update,
        "ℹ️ <b>So funktioniert's</b>\n\n"
        "1. Schick mir einen TikTok-Shop-Link (oder /neu)\n"
        "2. Gib deinen Einkaufspreis ein\n"
        "3. Wähle eine Preisstufe – du siehst direkt deinen echten Verlust nach Steuer\n"
        "4. Lade das Sample in deine Web-App hoch\n\n"
        "/neu – Sample hochladen\n/menu – Hauptmenü\n/konto – Konto & Steuersatz\n/abbrechen – aktuellen Vorgang abbrechen\n/abmelden – Telegram trennen",
    )


async def fallback_text(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    if store(ctx).get(update.effective_user.id):
        await say(update, "Schick mir einen TikTok-Shop-Link oder tippe auf „Sample hochladen“.", menu_buttons(ctx))
    else:
        await say(update, "Tippe /start, um dich mit deinem Web-App-Konto anzumelden.")


async def stale_button(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    await update.callback_query.answer("Diese Aktion ist abgelaufen.", show_alert=False)


async def on_error(update: object, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    log.exception("Fehler bei der Verarbeitung", exc_info=ctx.error)
    if isinstance(update, Update) and update.effective_chat:
        try:
            await update.effective_chat.send_message("⚠️ Da ist etwas schiefgelaufen. Versuch es bitte noch einmal.")
        except TelegramError:
            pass


async def post_init(app: Application) -> None:
    await app.bot.set_my_commands([
        BotCommand("neu", "Sample hochladen"),
        BotCommand("menu", "Hauptmenü"),
        BotCommand("konto", "Konto & Steuersatz"),
        BotCommand("hilfe", "So funktioniert's"),
        BotCommand("abbrechen", "Vorgang abbrechen"),
        BotCommand("abmelden", "Telegram trennen"),
    ])


# ---------------------------------------------------------------------------
# Aufbau
# ---------------------------------------------------------------------------
def build_app(config: Config, *, backend_impl: Backend | None = None, store_impl: SessionStore | None = None,
              request=None) -> Application:
    builder = ApplicationBuilder().token(config.token).post_init(post_init)
    if request is not None:   # Tests: Telegram-Verbindung ersetzen
        builder = builder.request(request).get_updates_request(request)
    app = builder.build()
    app.bot_data["config"] = config
    app.bot_data["backend"] = backend_impl or (ApiBackend(config.api_url) if config.api_url else DemoBackend(DATA_DIR / "demo.json"))
    app.bot_data["store"] = store_impl or SessionStore(DATA_DIR / "sessions.sqlite3")

    text = filters.TEXT & ~filters.COMMAND
    login_conv = ConversationHandler(
        entry_points=[CommandHandler("start", start), CommandHandler("login", start)],
        states={
            LOGIN_USER: [MessageHandler(text, login_user)],
            LOGIN_KEY: [MessageHandler(text, login_key)],
        },
        fallbacks=[CommandHandler("abbrechen", cancel), CallbackQueryHandler(cancel, pattern=r"^flow:cancel$"),
                   CommandHandler("start", start)],
        allow_reentry=True,
        name="login",
    )
    upload_conv = ConversationHandler(
        entry_points=[
            CommandHandler("neu", upload_start),
            CallbackQueryHandler(upload_start, pattern=r"^menu:upload$"),
            MessageHandler(text & filters.Regex(r"https?://"), link_entry),
        ],
        states={
            UP_LINK: [MessageHandler(text, up_link)],
            UP_PRICE: [MessageHandler(text, up_price), CallbackQueryHandler(up_price_shop, pattern=r"^price:shop$")],
            UP_TIER: [CallbackQueryHandler(up_tier, pattern=r"^tier:")],
            UP_VIDEO: [MessageHandler(text, up_video), CallbackQueryHandler(up_video_skip, pattern=r"^video:skip$")],
            UP_CONFIRM: [CallbackQueryHandler(up_confirm, pattern=r"^confirm:")],
        },
        fallbacks=[
            CommandHandler("abbrechen", cancel),
            CallbackQueryHandler(cancel, pattern=r"^flow:cancel$"),
            CallbackQueryHandler(menu_from_flow, pattern=r"^menu:(main|account)$"),
            CommandHandler("neu", upload_start),
        ],
        allow_reentry=True,
        conversation_timeout=1800,
        name="upload",
    )
    app.add_handler(login_conv)
    app.add_handler(upload_conv)
    app.add_handler(CommandHandler("konto", account))
    app.add_handler(CommandHandler(["menu", "menue"], main_menu))
    app.add_handler(CallbackQueryHandler(main_menu, pattern=r"^menu:main$"))
    app.add_handler(CallbackQueryHandler(account, pattern=r"^menu:account$"))
    app.add_handler(CallbackQueryHandler(logout_ask, pattern=r"^menu:logout_ask$"))
    app.add_handler(CommandHandler("abmelden", logout))
    app.add_handler(CallbackQueryHandler(logout, pattern=r"^menu:logout$"))
    app.add_handler(CommandHandler("hilfe", help_cmd))
    app.add_handler(CommandHandler("help", help_cmd))
    app.add_handler(CommandHandler("abbrechen", cancel))
    app.add_handler(CallbackQueryHandler(cancel, pattern=r"^flow:cancel$"))
    app.add_handler(MessageHandler(text, fallback_text))
    app.add_handler(CallbackQueryHandler(stale_button))
    app.add_error_handler(on_error)
    return app


def main() -> None:
    logging.basicConfig(format="%(asctime)s %(levelname)s %(name)s: %(message)s", level=logging.INFO)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    config = load_config()
    if not config.token:
        raise SystemExit("TELEGRAM_BOT_TOKEN fehlt. Lege bot/.env an (Vorlage: bot/.env.example).")
    log.info("Starte Bot (%s)", "Demo-Modus" if config.demo else f"API: {config.api_url[:48]}…")
    build_app(config).run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
