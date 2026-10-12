"""Anbindung an das Web-App-Konto.

ApiBackend:  spricht dieselbe Google-Apps-Script-API an wie die Web-App (backend/Code.gs).
DemoBackend: lokale JSON-Datei, solange noch keine API_URL gesetzt ist.
"""
from __future__ import annotations

import json
import secrets
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Protocol

import httpx


class BackendError(Exception):
    """Fehlermeldung, die direkt im Chat angezeigt werden kann."""


@dataclass(frozen=True)
class Creator:
    user_id: str
    status_code: Decimal | None  # Steuersatz als Dezimalzahl (0.30 = 30 %); None = nicht festgelegt (optional)
    telegram: str = ""


@dataclass(frozen=True)
class Credentials:
    user_id: str
    creator_key: str


@dataclass(frozen=True)
class NewSample:
    shop_link: str
    purchase: Decimal         # Einkaufspreis (Spalte F)
    tier: str                 # fair | schnell | sofort (Vorschläge) | eigen
    video_link: str
    name: str
    description: str
    category: str
    image: str
    shop_price: Decimal
    sale_price: Decimal | None = None  # nur bei tier == "eigen"


class Backend(Protocol):
    async def login(self, creds: Credentials) -> Creator: ...
    async def add_sample(self, creds: Credentials, sample: NewSample) -> dict[str, Any]: ...
    async def update_telegram(self, creds: Credentials, telegram: str) -> None: ...


def _creator(data: dict[str, Any]) -> Creator:
    return Creator(
        user_id=str(data["userId"]),
        status_code=None if data.get("statusCode") is None else Decimal(str(data["statusCode"])),
        telegram=str(data.get("telegram") or ""),
    )


def _sample_payload(sample: NewSample) -> dict[str, Any]:
    return {
        "shopLink": sample.shop_link,
        "price": float(sample.purchase),
        "tier": sample.tier,
        "videoLink": sample.video_link,
        "name": sample.name,
        "description": sample.description,
        "category": sample.category,
        "image": sample.image,
        "shopPrice": float(sample.shop_price),
        "source": "telegram",
        **({"salePrice": float(sample.sale_price)} if sample.sale_price is not None else {}),
    }


class ApiBackend:
    def __init__(self, url: str, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self.url = url
        self.transport = transport   # nur für Tests

    async def _post(self, payload: dict[str, Any]) -> dict[str, Any]:
        # text/plain wie im Browser; Apps Script antwortet per Redirect
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=30, transport=self.transport) as client:
                res = await client.post(self.url, content=json.dumps(payload),
                                        headers={"Content-Type": "text/plain;charset=utf-8"})
            data = res.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise BackendError("Die Web-App ist gerade nicht erreichbar. Versuch es gleich noch einmal.") from exc
        if not data.get("ok"):
            raise BackendError(data.get("error") or "Unbekannter Fehler.")
        return data

    async def login(self, creds: Credentials) -> Creator:
        data = await self._post({"action": "login", "userId": creds.user_id, "creatorKey": creds.creator_key})
        return _creator(data["creator"])

    async def add_sample(self, creds: Credentials, sample: NewSample) -> dict[str, Any]:
        data = await self._post({"action": "addProduct", "userId": creds.user_id,
                                 "creatorKey": creds.creator_key, **_sample_payload(sample)})
        return data["product"]

    async def update_telegram(self, creds: Credentials, telegram: str) -> None:
        await self._post({"action": "updateProfile", "userId": creds.user_id,
                          "creatorKey": creds.creator_key, "telegram": telegram})


class DemoBackend:
    """Lokaler Ersatz für die Web-App. Demo-Konto: demo / demo-1234 (Steuersatz 30 %)."""

    def __init__(self, path: Path) -> None:
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            self._save({"creators": {"demo": {"creatorKey": "demo-1234", "statusCode": 0.30, "telegram": ""}},
                        "products": []})

    def _load(self) -> dict[str, Any]:
        return json.loads(self.path.read_text(encoding="utf-8"))

    def _save(self, data: dict[str, Any]) -> None:
        self.path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def _auth(self, data: dict[str, Any], creds: Credentials) -> tuple[str, dict[str, Any]]:
        for user_id, c in data["creators"].items():
            if user_id.lower() == creds.user_id.lower() and c["creatorKey"] == creds.creator_key:
                return user_id, c
        raise BackendError("Login fehlgeschlagen. Username oder Creator-Key ist falsch.")

    async def login(self, creds: Credentials) -> Creator:
        user_id, c = self._auth(self._load(), creds)
        return _creator({"userId": user_id, **c})

    async def add_sample(self, creds: Credentials, sample: NewSample) -> dict[str, Any]:
        from pricing import TIER_BY_ID, tier_price  # lokal, um Zyklen zu vermeiden

        data = self._load()
        user_id, c = self._auth(data, creds)
        product = {
            "id": secrets.token_hex(8),
            "userId": user_id,
            "statusCode": c["statusCode"],
            **_sample_payload(sample),
            "salePrice": float(sample.sale_price if sample.sale_price is not None else tier_price(sample.purchase, TIER_BY_ID[sample.tier])),
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        data["products"].append(product)
        self._save(data)
        return {"id": product["id"], "price": product["salePrice"]}

    async def update_telegram(self, creds: Credentials, telegram: str) -> None:
        data = self._load()
        user_id, c = self._auth(data, creds)
        c["telegram"] = telegram
        self._save(data)
