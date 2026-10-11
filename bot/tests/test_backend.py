import json
import tempfile
import unittest
from decimal import Decimal as D
from pathlib import Path

import httpx

from backend import ApiBackend, BackendError, Credentials, DemoBackend, NewSample
from storage import SessionStore

SAMPLE = NewSample(
    shop_link="https://vm.tiktok.com/abc/", purchase=D("27.00"), tier="fair", video_link="",
    name="Testprodukt", description="Beschreibung", category="Tech",
    image="img/beta/earbuds.jpg", shop_price=D("39.90"),
)


class DemoBackendTest(unittest.IsolatedAsyncioTestCase):
    async def test_login_and_upload(self):
        with tempfile.TemporaryDirectory() as tmp:
            demo = DemoBackend(Path(tmp) / "demo.json")
            creator = await demo.login(Credentials("DEMO", "demo-1234"))
            self.assertEqual(creator.user_id, "demo")
            self.assertEqual(creator.status_code, D("0.3"))
            with self.assertRaises(BackendError):
                await demo.login(Credentials("demo", "falsch"))
            result = await demo.add_sample(Credentials("demo", "demo-1234"), SAMPLE)
            self.assertEqual(result["price"], 18.9)
            data = json.loads((Path(tmp) / "demo.json").read_text())
            self.assertEqual(data["products"][0]["tier"], "fair")
            self.assertEqual(data["products"][0]["source"], "telegram")


class ApiBackendTest(unittest.IsolatedAsyncioTestCase):
    """Simuliert Google Apps Script: POST → 302 → GET mit JSON-Antwort."""

    def make(self, responder):
        posted = []

        def handler(request: httpx.Request) -> httpx.Response:
            if request.method == "POST":
                posted.append(json.loads(request.content))
                return httpx.Response(302, headers={"Location": "https://script.googleusercontent.com/echo?id=1"})
            return httpx.Response(200, json=responder(posted[-1]))

        return ApiBackend("https://script.google.com/macros/s/X/exec", transport=httpx.MockTransport(handler)), posted

    async def test_login(self):
        api, posted = self.make(lambda p: {"ok": True, "creator": {"userId": "vik", "statusCode": 0.42, "telegram": ""}})
        creator = await api.login(Credentials("vik", "key"))
        self.assertEqual(creator.status_code, D("0.42"))
        self.assertEqual(posted[0], {"action": "login", "userId": "vik", "creatorKey": "key"})

    async def test_add_sample_payload(self):
        api, posted = self.make(lambda p: {"ok": True, "product": {"id": "x", "price": 18.9}})
        result = await api.add_sample(Credentials("vik", "key"), SAMPLE)
        self.assertEqual(result["price"], 18.9)
        body = posted[0]
        self.assertEqual(body["action"], "addProduct")
        self.assertEqual(body["tier"], "fair")
        self.assertEqual(body["price"], 27.0)
        self.assertEqual(body["shopPrice"], 39.9)
        self.assertEqual(body["source"], "telegram")

    async def test_error_message_is_passed_through(self):
        api, _ = self.make(lambda p: {"ok": False, "error": "Login fehlgeschlagen."})
        with self.assertRaisesRegex(BackendError, "Login fehlgeschlagen"):
            await api.login(Credentials("vik", "falsch"))


class StorageTest(unittest.TestCase):
    def test_roundtrip(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = SessionStore(Path(tmp) / "s.sqlite3")
            store.save(42, "vik", "key", D("0.30"))
            self.assertEqual(store.get(42).status_code, D("0.30"))
            store.update_status(42, D("0.42"))
            self.assertEqual(store.get(42).status_code, D("0.42"))
            store.delete(42)
            self.assertIsNone(store.get(42))


if __name__ == "__main__":
    unittest.main()
