"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabaseClient";

function normalizeResetError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("same password")) {
    return "Bitte waehle ein neues Passwort, das sich von deinem bisherigen unterscheidet.";
  }

  if (normalized.includes("password")) {
    return "Bitte pruefe dein neues Passwort und versuche es erneut.";
  }

  return message;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const { authLoading, user } = useAuth();
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!successMsg) return;

    const timeoutId = window.setTimeout(() => {
      router.push("/");
    }, 2200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [router, successMsg]);

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedPassword = password.trim();
    const trimmedPasswordConfirm = passwordConfirm.trim();

    if (!trimmedPassword) {
      setErrorMsg("Bitte gib ein neues Passwort ein.");
      setSuccessMsg(null);
      return;
    }

    if (trimmedPassword.length < 8) {
      setErrorMsg("Dein Passwort sollte mindestens 8 Zeichen lang sein.");
      setSuccessMsg(null);
      return;
    }

    if (trimmedPassword !== trimmedPasswordConfirm) {
      setErrorMsg("Die Passwoerter stimmen nicht ueberein.");
      setSuccessMsg(null);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const { error } = await supabase.auth.updateUser({
      password: trimmedPassword,
    });

    setSubmitting(false);

    if (error) {
      setErrorMsg(normalizeResetError(error.message));
      setSuccessMsg(null);
      return;
    }

    setSuccessMsg(
      "Dein Passwort wurde erfolgreich aktualisiert. Du wirst gleich zur App weitergeleitet."
    );
    setErrorMsg(null);
  }

  return (
    <main className="min-h-screen bg-[#0f3b2e] px-6 py-10 text-white">
      <div className="mx-auto max-w-[420px] rounded-[28px] border border-white/10 bg-white/5 p-6 text-center">
        {authLoading ? (
          <>
            <h1 className="text-2xl font-extrabold italic">Recovery-Link wird geprueft</h1>
            <p className="mt-3 text-sm text-white/80">
              Einen Moment bitte. Wir bereiten die Passwort-Aenderung vor.
            </p>
          </>
        ) : !user ? (
          <>
            <h1 className="text-2xl font-extrabold italic">Recovery-Link ungueltig</h1>
            <p className="mt-3 text-sm text-white/80">
              Bitte fordere den Link zum Zuruecksetzen deines Passworts erneut an.
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-[#e8decc] px-5 py-3 text-base font-semibold text-[#0f3b2e] transition hover:bg-[#ded3be]"
            >
              Zur Startseite
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold italic">Neues Passwort festlegen</h1>
            <p className="mt-3 text-sm text-white/80">
              Vergib jetzt ein neues Passwort fuer dein Konto. Es sollte sich von deinem bisherigen unterscheiden.
            </p>

            <form onSubmit={handlePasswordReset} className="mt-5 space-y-3 text-left">
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-[#e7dfcf] bg-[#fffaf2] px-4 py-3 text-[15px] font-medium text-[#0f2a22] placeholder:text-[#0f2a22]/50 focus:outline-none focus:ring-2 focus:ring-[#c6a85b]"
                placeholder="Neues Passwort"
                autoComplete="new-password"
              />

              <input
                type="password"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                className="w-full rounded-2xl border border-[#e7dfcf] bg-[#fffaf2] px-4 py-3 text-[15px] font-medium text-[#0f2a22] placeholder:text-[#0f2a22]/50 focus:outline-none focus:ring-2 focus:ring-[#c6a85b]"
                placeholder="Passwort bestaetigen"
                autoComplete="new-password"
              />

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-[#e8decc] px-5 py-3 text-base font-semibold text-[#0f3b2e] transition hover:bg-[#ded3be] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? "Speichere..." : "Passwort speichern"}
              </button>

              {errorMsg ? <p className="text-sm text-red-300">{errorMsg}</p> : null}
              {successMsg ? <p className="text-sm text-[#d8f0d6]">{successMsg}</p> : null}
            </form>

            <Link
              href="/"
              className="mt-5 inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-white/20 px-5 py-3 text-base font-semibold text-white transition hover:bg-white/10"
            >
              Zur App
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
