"use client";

import { useState, type FormEvent } from "react";
import { Buildings, Storefront } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { ChoiceTile } from "@/components/ui/ChoiceTile";
import { Notice } from "@/components/ui/Notice";
import { RateSelector, rateError, rateFromState, stateFromRate, type RateState } from "@/components/pricing/RateSelector";
import { updateStatus, updateTaxProfile, type TaxProfile } from "@/lib/api";
import { fmtPct } from "@/lib/pricing";
import { useDashboard } from "../DashboardShell";
import { PageHead, inputCls } from "../ui";

type Msg = { tone: "success" | "error"; text: string } | null;

const EMPTY: TaxProfile = { name: "", street: "", zip: "", city: "", email: "", taxNumber: "", vatId: "", iban: "", smallBusiness: true };

export function TaxSettings() {
  return (
    <div>
      <PageHead title="Steuerdaten" text="Dein Steuersatz für die Preisrechnung und deine Angaben für Rechnungen." />
      <div className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <RatePanel />
        <ProfilePanel />
      </div>
    </div>
  );
}

function RatePanel() {
  const { creds, creator, setCreator } = useDashboard();
  const [state, setState] = useState<RateState>(() => stateFromRate(creator.statusCode));
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    const err = rateError(state);
    if (err) return setMsg({ tone: "error", text: err });
    setBusy(true);
    try {
      const res = await updateStatus(creds, rateFromState(state)!);
      setCreator(res.creator);
      setMsg({ tone: "success", text: `Gespeichert: ${fmtPct(res.creator.statusCode)}. Der Bot übernimmt den neuen Steuersatz automatisch.` });
    } catch (ex) {
      setMsg({ tone: "error", text: (ex as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} noValidate aria-labelledby="rate-title" className="h-full rounded-card border border-white/[0.07] bg-ink-900 p-6 sm:p-8">
      <h2 id="rate-title" className="text-xl font-semibold tracking-tight">Grenzsteuersatz</h2>
      <p className="mt-2 leading-relaxed text-fg-muted">
        Aktuell <span className="font-medium text-fg">{fmtPct(creator.statusCode)}</span>. Daraus berechnen Bot und Web-App, wie viel du nach Steuer zurückbekommst.
      </p>
      <div className="mt-6">
        <RateSelector value={state} onChange={(s) => { setState(s); setMsg(null); }} idPrefix="dash" showQuestion={false} />
      </div>
      <div className="mt-6">
        <Notice>Die Schätzung über dein Einkommen ist ein Näherungswert. Den genauen Satz findest du in deinem letzten Steuerbescheid.</Notice>
      </div>
      {msg ? <div className="mt-4"><Notice tone={msg.tone}>{msg.text}</Notice></div> : null}
      <Button type="submit" variant="secondary" className="mt-6" disabled={busy}>{busy ? "Wird gespeichert …" : "Steuersatz speichern"}</Button>
    </form>
  );
}

function ProfilePanel() {
  const { creds, taxProfile, setTaxProfile } = useDashboard();
  const [p, setP] = useState<TaxProfile>(() => ({ ...EMPTY, ...taxProfile }));
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof TaxProfile) => (e: { target: { value: string } }) => { setP({ ...p, [k]: e.target.value }); setMsg(null); };

  async function save(e: FormEvent) {
    e.preventDefault();
    const missing = [!p.name.trim() && "Name", !p.street.trim() && "Straße", !p.zip.trim() && "PLZ", !p.city.trim() && "Ort"].filter(Boolean);
    if (missing.length) return setMsg({ tone: "error", text: `Bitte fülle aus: ${missing.join(", ")}.` });
    if (!p.taxNumber.trim() && !p.vatId.trim()) return setMsg({ tone: "error", text: "Bitte gib deine Steuernummer oder USt-IdNr. an (Pflicht auf Rechnungen)." });
    setBusy(true);
    try {
      const res = await updateTaxProfile(creds, p);
      setTaxProfile(res.taxProfile);
      setMsg({ tone: "success", text: "Gespeichert. Neue Rechnungen nutzen diese Angaben." });
    } catch (ex) {
      setMsg({ tone: "error", text: (ex as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const field = (k: keyof TaxProfile, label: string, opts: { auto?: string; optional?: boolean; mono?: boolean } = {}) => (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">
        {label} {opts.optional ? <span className="font-normal text-fg-subtle">(optional)</span> : null}
      </span>
      <input value={String(p[k])} onChange={set(k)} autoComplete={opts.auto} className={`${inputCls} ${opts.mono ? "font-mono" : ""}`} />
    </label>
  );

  return (
    <form onSubmit={save} noValidate aria-labelledby="profile-title" className="rounded-card border border-white/[0.07] bg-ink-900 p-6 sm:p-8">
      <h2 id="profile-title" className="text-xl font-semibold tracking-tight">Rechnungsdaten</h2>
      <p className="mt-2 leading-relaxed text-fg-muted">Erscheinen als Absender auf deinen Rechnungen.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">{field("name", "Name oder Firma", { auto: "name" })}</div>
        <div className="sm:col-span-2">{field("street", "Straße und Hausnummer", { auto: "address-line1" })}</div>
        {field("zip", "PLZ", { auto: "postal-code" })}
        {field("city", "Ort", { auto: "address-level2" })}
        <div className="sm:col-span-2">{field("email", "E-Mail", { auto: "email", optional: true })}</div>
        {field("taxNumber", "Steuernummer")}
        {field("vatId", "USt-IdNr.", { optional: true })}
        <div className="sm:col-span-2">{field("iban", "IBAN für Zahlungen", { optional: true, mono: true })}</div>
      </div>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium">Umsatzsteuer</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <ChoiceTile active={p.smallBusiness} onClick={() => setP({ ...p, smallBusiness: true })} icon={Storefront} title="Kleinunternehmer" text="Ohne Umsatzsteuer (§ 19 UStG)" />
          <ChoiceTile active={!p.smallBusiness} onClick={() => setP({ ...p, smallBusiness: false })} icon={Buildings} title="Regelbesteuerung" text="Mit 19 % oder 7 % USt" />
        </div>
      </fieldset>

      {msg ? <div className="mt-5"><Notice tone={msg.tone}>{msg.text}</Notice></div> : null}
      <Button type="submit" className="mt-6" disabled={busy}>{busy ? "Wird gespeichert …" : "Rechnungsdaten speichern"}</Button>
    </form>
  );
}
