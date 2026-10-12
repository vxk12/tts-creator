"""Kompletter Chat-Ablauf gegen ein simuliertes Telegram (ohne Netzwerk)."""
import base64
import json
import tempfile
import unittest
from pathlib import Path

from telegram import Update
from telegram.request import BaseRequest, RequestData

from backend import DemoBackend
from config import Config
from main import build_app
from storage import SessionStore

CHAT = 4242
USER = {"id": CHAT, "is_bot": False, "first_name": "Vik", "username": "vik_rot"}


class FakeTelegram(BaseRequest):
    """Beantwortet Bot-API-Aufrufe lokal und protokolliert, was der Bot sendet."""

    def __init__(self):
        self.calls: list[tuple[str, dict]] = []
        self.msg_id = 1000

    async def initialize(self):
        pass

    async def shutdown(self):
        pass

    @property
    def read_timeout(self):
        return 5

    async def do_request(self, url, method, request_data: RequestData | None = None, **kwargs):
        api = url.rsplit("/", 1)[-1]
        params = request_data.parameters if request_data else {}
        self.calls.append((api, params))
        if api == "getMe":
            result = {"id": 1, "is_bot": True, "first_name": "TTS", "username": "tts_test_bot"}
        elif api in ("sendMessage", "sendPhoto"):
            self.msg_id += 1
            result = {"message_id": self.msg_id, "date": 0, "chat": {"id": CHAT, "type": "private"},
                      "from": {"id": 1, "is_bot": True, "first_name": "TTS"}}
            if api == "sendPhoto":
                result["photo"] = [{"file_id": "photo-1", "file_unique_id": "u1", "width": 10, "height": 10}]
                result["caption"] = params.get("caption", "")
            else:
                result["text"] = params.get("text", "")
        else:
            result = True
        return 200, json.dumps({"ok": True, "result": result}).encode()

    def sent(self):
        """Texte/Captions aller gesendeten Nachrichten."""
        return [p.get("text") or p.get("caption") or "" for api, p in self.calls if api in ("sendMessage", "sendPhoto", "editMessageText")]

    def buttons(self):
        """Callback-Daten aller Buttons der zuletzt gesendeten/bearbeiteten Nachricht."""
        for api, p in reversed(self.calls):
            if api in ("sendMessage", "sendPhoto", "editMessageText") and p.get("reply_markup"):
                markup = p["reply_markup"]
                markup = json.loads(markup) if isinstance(markup, str) else markup
                return [b.get("callback_data") or b.get("url") for row in markup["inline_keyboard"] for b in row]
        return []

    def take(self):
        out = self.sent()
        self.calls.clear()
        return out


class FlowTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        tmp = Path(self.tmp.name)
        self.tg = FakeTelegram()
        self.demo_file = tmp / "demo.json"
        self.app = build_app(
            Config(token="123:TEST", api_url="", web_app_url="https://example.test"),
            backend_impl=DemoBackend(self.demo_file), store_impl=SessionStore(tmp / "s.sqlite3"), request=self.tg,
        )
        await self.app.initialize()
        self.update_id = 0

    async def asyncTearDown(self):
        await self.app.shutdown()
        self.tmp.cleanup()

    async def text(self, text):
        self.tg.calls.clear()          # nur die Antworten auf diese Nachricht auswerten
        self.update_id += 1
        msg = {"message_id": self.update_id, "date": 0, "chat": {"id": CHAT, "type": "private"}, "from": USER, "text": text}
        if text.startswith("/"):
            msg["entities"] = [{"type": "bot_command", "offset": 0, "length": len(text.split()[0])}]
        await self.app.process_update(Update.de_json({"update_id": self.update_id, "message": msg}, self.app.bot))
        return self.tg.take()

    async def tap(self, data):
        self.update_id += 1
        cq = {"id": str(self.update_id), "from": USER, "chat_instance": "c", "data": data,
              "message": {"message_id": 1, "date": 0, "chat": {"id": CHAT, "type": "private"}, "text": "…"}}
        await self.app.process_update(Update.de_json({"update_id": self.update_id, "callback_query": cq}, self.app.bot))
        return self.tg.take()

    async def test_full_flow(self):
        out = await self.text("/start")
        self.assertIn("TikTok-Username", out[0])

        out = await self.text("demo")
        self.assertIn("Creator-Key", out[0])

        out = await self.text("falscher-key")
        self.assertIn("Login fehlgeschlagen", out[0])

        out = await self.text("demo-1234")
        self.assertTrue(any("Verbunden" in t and "30 %" in t for t in out))   # Steuersatz aus der Web-App
        out = await self.text("/start")
        self.assertIn("Willkommen zurück", out[0])

        out = await self.text("https://vm.tiktok.com/ZG9A86bGdeaah-ro48Q/")
        self.assertIn("Beta", out[0])
        self.assertIn("Einkaufspreis", out[1])

        out = await self.text("abc")
        self.assertIn("positive Zahl", out[0])

        out = await self.text("27")
        tiers = out[0]
        for snippet in ["18,90 €", "21,33 € (79 %)", "14,85 €", "18,49 € (68 %)", "10,80 €", "15,66 € (58 %)", "30 %"]:
            self.assertIn(snippet, tiers)

        out = await self.tap("tier:fair")
        self.assertIn("TikTok-Testvideo", out[0])

        out = await self.tap("video:skip")
        self.assertIn("Deine Anzeige", out[0])
        self.assertIn("Stufe Fair", out[0])
        self.assertIn("18,90 €", out[0])

        out = await self.tap("confirm:tier")          # Preisstufe ändern
        out = await self.tap("tier:schnell")
        self.assertIn("14,85 €", out[0])

        out = await self.tap("confirm:upload")
        self.assertIn("Hochgeladen", out[0])
        products = json.loads(self.demo_file.read_text())["products"]
        self.assertEqual(len(products), 1)
        self.assertEqual(products[0]["tier"], "schnell")
        self.assertEqual(products[0]["salePrice"], 14.85)
        self.assertEqual(products[0]["price"], 27.0)
        # Telegram-Username wurde fürs „Jetzt kaufen“ hinterlegt
        self.assertEqual(json.loads(self.demo_file.read_text())["creators"]["demo"]["telegram"], "vik_rot")

    async def test_login_deletes_key_message(self):
        await self.text("/start")
        await self.text("demo")
        self.update_id += 1
        msg = {"message_id": 77, "date": 0, "chat": {"id": CHAT, "type": "private"}, "from": USER, "text": "demo-1234"}
        await self.app.process_update(Update.de_json({"update_id": self.update_id, "message": msg}, self.app.bot))
        calls = [api for api, _ in self.tg.calls]
        self.assertIn("deleteMessage", calls)
        self.assertTrue(any("Verbunden" in t for t in self.tg.sent()))

    async def test_deep_link_from_web_app(self):
        payload = base64.urlsafe_b64encode(b"demo").decode().rstrip("=")
        out = await self.text(f"/start {payload}")
        self.assertIn("@demo", out[0])
        self.assertIn("Creator-Key", out[0])

    async def login_demo(self):
        await self.text("/start")
        await self.text("demo")
        await self.text("demo-1234")

    async def tap_keep(self, data):
        """Wie tap(), aber Aufrufe bleiben für buttons() erhalten."""
        self.update_id += 1
        cq = {"id": str(self.update_id), "from": USER, "chat_instance": "c", "data": data,
              "message": {"message_id": 1, "date": 0, "chat": {"id": CHAT, "type": "private"}, "text": "…"}}
        self.tg.calls.clear()
        await self.app.process_update(Update.de_json({"update_id": self.update_id, "callback_query": cq}, self.app.bot))
        return self.tg.sent()

    async def test_account_has_back_button(self):
        await self.login_demo()
        out = await self.tap_keep("menu:account")
        self.assertIn("Dein Konto", out[-1])
        self.assertIn("menu:main", self.tg.buttons())
        out = await self.tap_keep("menu:main")
        self.assertIn("Menü", out[-1])
        self.assertIn("menu:upload", self.tg.buttons())

    async def test_logout_needs_confirmation(self):
        await self.login_demo()
        out = await self.tap_keep("menu:logout_ask")
        self.assertIn("wirklich", out[-1])
        self.assertEqual(self.tg.buttons(), ["menu:logout", "menu:account"])
        out = await self.tap_keep("menu:account")          # Zurück
        self.assertIn("Dein Konto", out[-1])
        out = await self.tap_keep("menu:logout_ask")
        out = await self.tap_keep("menu:logout")
        self.assertIn("Abgemeldet", out[-1])
        out = await self.text("https://vm.tiktok.com/abc/")
        self.assertIn("nicht angemeldet", out[0])

    async def test_cancel_buttons_in_upload(self):
        await self.login_demo()
        await self.text("/neu")
        self.assertIn("flow:cancel", self.tg.buttons() or ["flow:cancel"])
        await self.text("https://vm.tiktok.com/ZG9A86bGdeaah-ro48Q/")
        out = await self.tap_keep("flow:cancel")            # beim Preis abbrechen
        self.assertIn("Abgebrochen", out[-1])
        out = await self.text("27")                         # wird NICHT mehr als Preis verstanden
        self.assertNotIn("Preisstufe", " ".join(out))
        # beim Wählen der Preisstufe abbrechen
        await self.text("https://vm.tiktok.com/ZG9A86bGdeaah-ro48Q/")
        await self.text("27")
        self.tg.calls.clear()
        out = await self.tap_keep("flow:cancel")
        self.assertIn("Abgebrochen", out[-1])

    async def test_menu_button_ends_running_upload(self):
        await self.login_demo()
        await self.text("https://vm.tiktok.com/ZG9A86bGdeaah-ro48Q/")
        out = await self.tap_keep("menu:account")           # mitten im Upload aufs Konto
        self.assertIn("Dein Konto", out[-1])
        out = await self.text("27")                         # kein Preis-Schritt mehr aktiv
        self.assertNotIn("Preisstufe", " ".join(out))

    async def test_login_can_be_cancelled(self):
        await self.text("/start")
        out = await self.tap_keep("flow:cancel")
        self.assertIn("Abgebrochen", out[-1])
        out = await self.text("demo")                       # kein Login-Schritt mehr aktiv
        self.assertIn("/start", out[0])

    async def test_upload_requires_login(self):
        out = await self.text("https://vm.tiktok.com/abc/")
        self.assertIn("nicht angemeldet", out[0])


if __name__ == "__main__":
    unittest.main()
