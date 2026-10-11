import type { Metadata } from "next";
import { Nav } from "@/components/ui/Nav";
import { Onboarding } from "@/components/onboarding/Onboarding";

export const metadata: Metadata = {
  title: "Registrieren",
  robots: { index: false },
};

export default function RegisterPage() {
  return (
    <>
      <Nav />
      <main>
        <Onboarding />
      </main>
    </>
  );
}
