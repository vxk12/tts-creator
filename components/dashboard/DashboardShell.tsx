"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Package, Receipt, SignOut, UserCircle, type Icon } from "@phosphor-icons/react";
import { getSamples, login, session, type Creator, type Credentials, type Sample, type TaxProfile } from "@/lib/api";
import { fmtRate } from "@/lib/pricing";
import { LoginForm } from "./LoginForm";

interface DashboardState {
  creds: Credentials;
  creator: Creator;
  setCreator: (c: Creator) => void;
  taxProfile: TaxProfile | null;
  setTaxProfile: (p: TaxProfile) => void;
  samples: Sample[] | null;
  samplesError: string;
  reloadSamples: () => Promise<void>;
  patchSample: (id: string, patch: Partial<Sample>) => void;
  logout: () => void;
}

const Ctx = createContext<DashboardState | null>(null);

export function useDashboard() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDashboard außerhalb von DashboardShell");
  return v;
}

const NAV: { href: string; label: string; icon: Icon; children?: { href: string; label: string }[] }[] = [
  { href: "/dashboard", label: "Samples", icon: Package },
  {
    href: "/dashboard/steuer",
    label: "Steuer",
    icon: Receipt,
    children: [
      { href: "/dashboard/steuer", label: "Übersicht" },
      { href: "/dashboard/steuer/rechnungen", label: "Rechnungen" },
      { href: "/dashboard/steuer/daten", label: "Steuerdaten" },
    ],
  },
  { href: "/dashboard/konto", label: "Konto", icon: UserCircle },
];

/** Login-Schranke, gemeinsame Daten und Navigation für alle Dashboard-Bereiche. */
export function DashboardShell({ children }: { children: ReactNode }) {
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [creator, setCreator] = useState<Creator | null>(null);
  const [taxProfile, setTaxProfile] = useState<TaxProfile | null>(null);
  const [booting, setBooting] = useState(true);
  const [loginError, setLoginError] = useState("");
  const [samples, setSamples] = useState<Sample[] | null>(null);
  const [samplesError, setSamplesError] = useState("");

  const doLogin = useCallback(async (c: Credentials) => {
    const res = await login(c);
    const next = { userId: res.creator.userId, creatorKey: c.creatorKey };
    session.set(next);
    setCreds(next);
    setCreator(res.creator);
    setTaxProfile(res.taxProfile ?? null);
  }, []);

  useEffect(() => {
    const saved = session.get();
    if (!saved) return setBooting(false);
    doLogin(saved)
      .catch((e: Error) => { session.clear(); setLoginError(e.message); })
      .finally(() => setBooting(false));
  }, [doLogin]);

  const userId = creator?.userId;
  const reloadSamples = useCallback(async () => {
    if (!userId) return;
    try {
      setSamples(await getSamples(userId));
      setSamplesError("");
    } catch (e) {
      setSamplesError((e as Error).message);
      setSamples([]);
    }
  }, [userId]);

  useEffect(() => { reloadSamples(); }, [reloadSamples]);

  const patchSample = useCallback((id: string, patch: Partial<Sample>) => {
    setSamples((list) => list?.map((s) => (s.id === id ? { ...s, ...patch } : s)) ?? list);
  }, []);

  if (booting) return <ShellSkeleton />;
  if (!creds || !creator) return <LoginForm onLogin={doLogin} initialError={loginError} />;

  const logout = () => {
    session.clear();
    setCreds(null);
    setCreator(null);
    setTaxProfile(null);
    setSamples(null);
  };

  return (
    <Ctx.Provider value={{ creds, creator, setCreator, taxProfile, setTaxProfile, samples, samplesError, reloadSamples, patchSample, logout }}>
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 md:pt-10 lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-12 lg:px-8">
        <Sidebar creator={creator} onLogout={logout} />
        <MobileTabs />
        <div className="min-w-0">{children}</div>
      </div>
    </Ctx.Provider>
  );
}

const isActive = (path: string, href: string) => (href === "/dashboard" ? path === "/dashboard" : path === href || path.startsWith(href + "/"));

function Sidebar({ creator, onLogout }: { creator: Creator; onLogout: () => void }) {
  const path = usePathname();
  const reduce = useReducedMotion();
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-24">
        <p className="truncate font-medium">@{creator.userId}</p>
        <p className="mt-0.5 text-sm text-fg-subtle tabular">Steuersatz {fmtRate(creator.statusCode)}</p>

        <nav aria-label="Dashboard" className="mt-8 grid gap-1">
          {NAV.map((item) => {
            const active = isActive(path, item.href);
            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  aria-current={path === item.href ? "page" : undefined}
                  className={`relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${active ? "text-fg" : "text-fg-muted hover:text-fg"}`}
                >
                  {active ? (
                    <motion.span
                      layoutId="dash-nav"
                      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
                      className="absolute inset-0 rounded-xl bg-white/[0.06]"
                    />
                  ) : null}
                  <item.icon size={18} weight={active ? "fill" : "regular"} className={`relative ${active ? "text-neon" : ""}`} aria-hidden="true" />
                  <span className="relative">{item.label}</span>
                </Link>
                {item.children && active ? (
                  <div className="ml-[1.4rem] mt-1 grid gap-0.5 border-l border-white/[0.08] py-1 pl-3">
                    {item.children.map((c) => (
                      <Link
                        key={c.href}
                        href={c.href}
                        aria-current={path === c.href ? "page" : undefined}
                        className={`rounded-lg px-2 py-1.5 text-sm transition-colors ${path === c.href ? "text-neon" : "text-fg-muted hover:text-fg"}`}
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <button type="button" onClick={onLogout} className="mt-8 inline-flex items-center gap-2 px-3 text-sm text-fg-muted transition-colors hover:text-fg">
          <SignOut size={16} /> Abmelden
        </button>
      </div>
    </aside>
  );
}

function MobileTabs() {
  const path = usePathname();
  const sub = NAV.find((n) => n.children && isActive(path, n.href))?.children;
  const pill = (active: boolean) =>
    `inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${active ? "bg-neon text-neon-ink" : "border border-white/10 text-fg-muted hover:text-fg"}`;
  return (
    <div className="-mx-4 mb-8 grid gap-2 px-4 lg:hidden">
      <nav aria-label="Dashboard" className="flex gap-2 overflow-x-auto pb-1">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={isActive(path, n.href) ? "page" : undefined} className={pill(isActive(path, n.href))}>
            <n.icon size={16} weight={isActive(path, n.href) ? "fill" : "regular"} aria-hidden="true" /> {n.label}
          </Link>
        ))}
      </nav>
      {sub ? (
        <nav aria-label="Steuer" className="flex gap-4 overflow-x-auto border-b border-white/[0.08] text-sm">
          {sub.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              aria-current={path === c.href ? "page" : undefined}
              className={`-mb-px shrink-0 border-b-2 py-2.5 transition-colors ${path === c.href ? "border-neon text-fg" : "border-transparent text-fg-muted"}`}
            >
              {c.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-12 lg:px-8" aria-busy="true" aria-label="Wird geladen">
      <div className="hidden gap-3 lg:grid lg:content-start">{[0, 1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-white/[0.04]" />)}</div>
      <div>
        <div className="h-10 w-64 animate-pulse rounded-xl bg-white/[0.05]" />
        <div className="mt-8 grid gap-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-white/[0.04]" />)}</div>
      </div>
    </div>
  );
}
