import type { Metadata } from "next";
import { TaxOverview } from "@/components/dashboard/tax/TaxOverview";

export const metadata: Metadata = { title: "Steuer" };

export default function Page() {
  return <TaxOverview />;
}
