import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { offer, parseMoney, parseRatePercent, TIERS } from "../lib/pricing.ts";

test("Beispiel 27 € bei 30 %", () => {
  const exp = { fair: [18.9, 5.67], schnell: [14.85, 8.51], sofort: [10.8, 11.34] } as const;
  for (const [id, [price, loss]] of Object.entries(exp)) {
    const o = offer(27, id, 0.3);
    assert.equal(o.price, price, id);
    assert.equal(o.loss, loss, id);
    assert.equal(Math.abs(Math.round((o.diff - o.loss - o.taxSaving) * 100)), 0, id);
  }
});

test("Eingaben parsen", () => {
  assert.equal(parseMoney("27,90"), 27.9);
  assert.equal(parseMoney("1.299,00"), 1299);
  assert.ok(Number.isNaN(parseMoney("abc")));
  assert.equal(parseRatePercent("35"), 0.35);
  assert.equal(parseRatePercent("42,5"), 0.425);
  assert.equal(parseRatePercent("75"), null);
});

test("Website und Bot rechnen cent-genau gleich (Vergleich mit bot/pricing.py)", () => {
  let seed = 11;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const rates = [0, 0.3, 0.42, 0.35, 0.255, 0.47, 0.14];
  const rows: string[] = [];
  for (let i = 0; i < 3000; i++) {
    const purchase = Math.round((0.5 + rnd() * 1500) * 100) / 100;
    const rate = rates[i % rates.length];
    for (const t of TIERS) {
      const o = offer(purchase, t.id, rate);
      rows.push([purchase.toFixed(2), String(rate), t.id, o.price.toFixed(2), o.loss.toFixed(2)].join(";"));
    }
  }
  const py = `
import sys
sys.path.insert(0, "bot")
from decimal import Decimal as D
from pricing import TIER_BY_ID, tier_price, real_loss
bad = 0
for line in sys.stdin:
    purchase, rate, tid, jp, jl = line.strip().split(";")
    p = tier_price(D(purchase), TIER_BY_ID[tid]); l = real_loss(D(purchase), p, D(rate))
    if f"{p:.2f}" != jp or f"{l:.2f}" != jl: bad += 1
print(bad)`;
  const out = execFileSync("bot/.venv/bin/python", ["-c", py], { input: rows.join("\n") }).toString().trim();
  assert.equal(out, "0", `${out} Abweichungen bei ${rows.length} Fällen`);
});
