"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export default function AuthCallbackPage() {
  const { authLoading, user } = useAuth();

  return (
    <main className="min-h-screen bg-[#0f3b2e] px-6 py-10 text-white">
      <div className="mx-auto max-w-[420px] rounded-[28px] border border-white/10 bg-white/5 p-6 text-center">
        {authLoading ? (
          <>
            <h1 className="text-2xl font-extrabold italic">Anmeldung wird abgeschlossen</h1>
            <p className="mt-3 text-sm text-white/80">
              Einen Moment bitte. Wir pruefen deinen Login-Link.
            </p>
          </>
        ) : user ? (
          <>
            <h1 className="text-2xl font-extrabold italic">Du bist jetzt eingeloggt</h1>
            <p className="mt-3 text-sm text-white/80">
              Oeffne Junior&apos;s Taste ueber dein Home-Screen-Icon fuer die beste Erfahrung.
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-[#e8decc] px-5 py-3 text-base font-semibold text-[#0f3b2e] transition hover:bg-[#ded3be]"
            >
              Zur App wechseln
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold italic">Login konnte nicht bestaetigt werden</h1>
            <p className="mt-3 text-sm text-white/80">
              Bitte oeffne den Link aus der E-Mail erneut oder kehre zur Startseite zurueck.
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-[#e8decc] px-5 py-3 text-base font-semibold text-[#0f3b2e] transition hover:bg-[#ded3be]"
            >
              Zur Startseite
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
