import type { Metadata } from "next";
import { AccountView } from "@/components/dashboard/AccountView";

export const metadata: Metadata = { title: "Konto" };

export default function Page() {
  return <AccountView />;
}
