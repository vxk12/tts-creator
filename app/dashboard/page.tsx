import type { Metadata } from "next";
import { Nav } from "@/components/ui/Nav";
import { Dashboard } from "@/components/dashboard/Dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false },
};

export default function DashboardPage() {
  return (
    <>
      <Nav />
      <main>
        <Dashboard />
      </main>
    </>
  );
}
