import type { Metadata } from "next";
import { InvoicesView } from "@/components/dashboard/tax/InvoicesView";

export const metadata: Metadata = { title: "Rechnungen" };

export default function Page() {
  return <InvoicesView />;
}
