"""Preislogik: drei Preisstufen + was nach Steuer zurückkommt.

Muss zu PRICING.TIERS in assets/js/api.js und zu TIERS in backend/Code.gs passen.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

CENT = Decimal("0.01")


@dataclass(frozen=True)
class Tier:
    id: str
    label: str
    factor: Decimal
    emoji: str


TIERS: tuple[Tier, ...] = (
    Tier("fair", "Fair", Decimal("0.70"), "🟢"),
    Tier("schnell", "Schnell", Decimal("0.55"), "🟡"),
    Tier("sofort", "Sofort weg", Decimal("0.40"), "🔴"),
)
TIER_BY_ID = {t.id: t for t in TIERS}


def round2(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def tier_price(purchase: Decimal, tier: Tier) -> Decimal:
    """Verkaufspreis der Stufe = Einkaufspreis × Faktor."""
    return round2(purchase * tier.factor)


def real_loss(purchase: Decimal, price: Decimal, tax_rate: Decimal) -> Decimal:
    """Echter Verlust = (Einkaufspreis − Verkaufspreis) × (1 − Steuersatz)."""
    return round2((purchase - price) * (Decimal(1) - tax_rate))


def payback(purchase: Decimal, price: Decimal, tax_rate: Decimal) -> Decimal:
    """Zurück nach Steuer = Einkaufspreis − echter Verlust (= Verkaufspreis + Steuervorteil)."""
    return purchase - real_loss(purchase, price, tax_rate)


def tax_extra(purchase: Decimal, price: Decimal, tax_rate: Decimal | None) -> Decimal:
    """Was später über die Steuer dazukommt (Steuervorteil). 0 ohne Steuersatz."""
    return payback(purchase, price, tax_rate) - price if tax_rate else Decimal(0)


def parse_money(text: str) -> Decimal | None:
    """'27,90' / '27.90' / '27 €' / '1.299,00' → Decimal (nur positive Beträge)."""
    s = re.sub(r"[\s€]", "", text or "")
    if not s:
        return None
    if re.search(r",\d{1,2}$", s):          # deutsches Format: 1.299,00
        s = s.replace(".", "").replace(",", ".")
    else:                                    # 1,299.00 oder 27.90
        s = s.replace(",", "")
    if not re.fullmatch(r"\d+(\.\d+)?", s):
        return None
    try:
        value = round2(Decimal(s))
    except InvalidOperation:
        return None
    if value <= 0 or value > Decimal("100000"):
        return None
    return value


def fmt_eur(value: Decimal) -> str:
    """Decimal → '1.299,90 €'."""
    q = round2(value)
    whole, frac = f"{q:.2f}".split(".")
    whole = f"{int(whole):,}".replace(",", ".")
    return f"{whole},{frac} €"


def fmt_rate(rate: Decimal | None) -> str:
    if rate is None:
        return "nicht festgelegt"
    pct = (rate * 100).normalize()
    text = f"{pct:f}".replace(".", ",")
    return f"{text} %"
