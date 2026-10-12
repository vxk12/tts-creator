"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { normalizeUser, session, type Credentials } from "@/lib/api";
import { inputCls } from "./ui";

export function LoginForm({ onLogin, initialError }: { onLogin: (c: Credentials) => Promise<void>; initialError: string }) {
  const [userId, setUserId] = useState(() => (typeof window !== "undefined" ? session.get()?.userId ?? "" : ""));
  const [key, setKey] = useState("");
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!userId.trim() || !key.trim()) return setError("Bitte Username und Creator-Key eingeben.");
    setBusy(true);
    setError("");
    try {
      await onLogin({ userId: normalizeUser(userId), creatorKey: key.trim() });
    } catch (ex) {
      setError((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-24 pt-14 sm:px-6 md:pt-20">
      <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Login</h1>
      <p className="mt-4 text-lg leading-relaxed text-fg-muted">Mit deinem TikTok-Username und dem Creator-Key aus der Registrierung.</p>
      <form onSubmit={submit} noValidate className="mt-10 grid gap-6">
        <div className="grid gap-2">
          <label htmlFor="login-user" className="text-sm font-medium">TikTok-Username</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-subtle">@</span>
            <input id="login-user" autoComplete="username" autoCapitalize="off" spellCheck={false} value={userId} onChange={(e) => setUserId(e.target.value)} className={`${inputCls} pl-9`} />
          </div>
        </div>
        <div className="grid gap-2">
          <label htmlFor="login-key" className="text-sm font-medium">Creator-Key</label>
          <input id="login-key" type="password" autoComplete="current-password" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} className={`${inputCls} font-mono`} />
        </div>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button type="submit" size="lg" disabled={busy}>{busy ? "Wird geprüft …" : "Login"}</Button>
      </form>
      <p className="mt-8 text-sm text-fg-muted">
        Noch kein Konto? <Link href="/registrieren" className="font-medium text-fg underline decoration-white/30 underline-offset-4 hover:decoration-neon">Registrieren</Link>
      </p>
    </div>
  );
}
