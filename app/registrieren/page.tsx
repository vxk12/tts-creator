import type { Metadata } from "next";
import { Onboarding } from "@/components/onboarding/Onboarding";

export const metadata: Metadata = {
  title: "Registrieren",
  robots: { index: false },
};

// Fokus-Modus: eigene Kopfzeile mit Fortschritt statt der Hauptnavigation
export default function RegisterPage() {
  return <Onboarding />;
}
