import type { Metadata } from "next";
import { TaxSettings } from "@/components/dashboard/tax/TaxSettings";

export const metadata: Metadata = { title: "Steuerdaten" };

export default function Page() {
  return <TaxSettings />;
}
