"""Beta: Produktdaten zu einem TikTok-Shop-Link.

Solange es noch keine echte TikTok-Shop-Anbindung (Scraping) gibt, liefert diese Funktion
für jeden Link deterministisch ein Beispielprodukt aus dem Katalog. Später wird
`product_from_link` durch den echten Abruf ersetzt – der Rest des Bots bleibt gleich.
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path

from config import REPO_DIR

LINK_RE = re.compile(r"https?://\S+", re.IGNORECASE)
TIKTOK_RE = re.compile(r"^https?://([a-z0-9-]+\.)*tiktok\.com/", re.IGNORECASE)


@dataclass(frozen=True)
class Product:
    name: str
    description: str
    shop_price: Decimal
    category: str
    image: str            # Pfad relativ zur Web-App (z. B. assets/img/beta/earbuds.jpg)

    @property
    def image_file(self) -> Path:
        return REPO_DIR / self.image


CATALOG: tuple[Product, ...] = (
    Product("Kabellose In-Ear-Kopfhörer mit Ladecase", "True-Wireless-Kopfhörer mit Noise-Cancelling, bis zu 30 h Akkulaufzeit mit Ladecase.", Decimal("39.90"), "Tech", "assets/img/beta/earbuds.jpg"),
    Product("Gesichtsmassagegerät mit Mikrostrom", "Mikrostrom-Gerät für die Gesichtspflege mit drei Intensitätsstufen und Ladestation.", Decimal("129.00"), "Beauty", "assets/img/beta/beauty-device.jpg"),
    Product("Tragbarer Akku-Mixer to go", "Kabelloser Mini-Mixer für Shakes und Smoothies, per USB-C aufladbar.", Decimal("29.99"), "Haushalt", "assets/img/beta/mixer.jpg"),
    Product("Powerbank 10.000 mAh mit USB-C", "Kompakte Powerbank mit USB-C Power Delivery und zwei Ausgängen.", Decimal("24.99"), "Tech", "assets/img/beta/powerbank.jpg"),
    Product("Gesichtsserum 3er-Set", "Drei Seren mit Niacinamid, Hyaluron und Vitamin C im Set.", Decimal("34.90"), "Beauty", "assets/img/beta/serum.jpg"),
    Product("Make-up Starter-Set mit Lidschatten-Palette", "Lidschatten-Palette, Foundation und Pinsel im Set.", Decimal("44.00"), "Beauty", "assets/img/beta/makeup.jpg"),
    Product("Smartwatch mit AMOLED-Display", "Smartwatch mit Pulsmessung, Schlaftracking und 7 Tagen Akkulaufzeit.", Decimal("79.00"), "Tech", "assets/img/beta/watch.jpg"),
    Product("Schreibtisch-Set mit kabellosem Ladepad", "Ordnungs-Set für den Schreibtisch mit integriertem Qi-Ladepad.", Decimal("49.00"), "Sonstiges", "assets/img/beta/desk.jpg"),
)


def extract_link(text: str) -> str | None:
    match = LINK_RE.search(text or "")
    return match.group(0).rstrip(").,") if match else None


def is_tiktok_link(link: str) -> bool:
    return bool(TIKTOK_RE.match(link))


def product_from_link(link: str) -> Product:
    """Beta: gleicher Link → immer dasselbe Beispielprodukt."""
    digest = hashlib.sha256(link.strip().lower().encode("utf-8")).digest()
    return CATALOG[digest[0] % len(CATALOG)]
