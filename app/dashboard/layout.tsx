import type { Metadata } from "next";
import { Nav } from "@/components/ui/Nav";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s | Dashboard | TTS Deals" },
  robots: { index: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main>
        <DashboardShell>{children}</DashboardShell>
      </main>
    </>
  );
}
