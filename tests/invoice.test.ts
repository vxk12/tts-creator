import { test } from "node:test";
import assert from "node:assert/strict";
import { invoiceTotals, fmtDate } from "../lib/invoice.ts";

test("Rechnungsbeträge cent-genau", () => {
  const t = invoiceTotals([{ description: "A", qty: 3, unitPrice: 0.1 }, { description: "B", qty: 1, unitPrice: 18.9 }], 0.19);
  assert.equal(t.net, 19.2);
  assert.equal(t.vat, 3.65); // 1920 × 0,19 = 364,8 → 365 Cent
  assert.equal(t.gross, 22.85);
  assert.equal(t.items[0].total, 0.3);
});

test("Kleinunternehmer ohne Umsatzsteuer", () => {
  const t = invoiceTotals([{ description: "Sample", qty: 1, unitPrice: 14.85 }], 0);
  assert.deepEqual([t.net, t.vat, t.gross], [14.85, 0, 14.85]);
});

test("Datum", () => assert.equal(fmtDate("2026-10-12"), "12.10.2026"));
