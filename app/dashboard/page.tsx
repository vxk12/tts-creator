import type { Metadata } from "next";
import { SamplesView } from "@/components/dashboard/SamplesView";

export const metadata: Metadata = { title: "Samples" };

export default function Page() {
  return <SamplesView />;
}
