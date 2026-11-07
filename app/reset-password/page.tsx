"use client";

import type { AuthError, Session } from "@supabase/supabase-js";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabaseClient";

type RecoveryState = "checking" | "ready" | "invalid" | "signOutError" | "success";

function getRecoveryLinkParams() {
  if (typeof window === "undefined") return null;
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return {
    hasRecoveryLink:
      hash.get("type") === "recovery" ||
      query.get("type") === "recovery" ||
      query.has("code"),
    hashType: hash.get("type"),
    hashAccessToken: hash.get("access_token"),
    hashRefreshToken: hash.get("refresh_token"),
  };
}

function recoveryErrorMessage(error?: AuthError | null) {
  const message = error?.message.toLowerCase() ?? "";
  if (message.includes("expired") || message.includes("invalid") || message.includes("otp") || message.includes("code verifier")) {
    return "Dieser Link ist abgelaufen, ungültig oder wurde bereits verwendet. Bitte fordere einen neuen Link an.";
  }
  return "Der Recovery-Link konnte nicht bestätigt werden. Bitte fordere einen neuen Link an.";
}

function updateErrorMessage(error: AuthError) {
  const message = error.message.toLowerCase();
  if (message.includes("same password")) {
    return "Bitte wähle ein neues Passwort, das sich von deinem bisherigen unterscheidet.";
  }
  if (message.includes("session") || message.includes("jwt")) {
    return "Deine Recovery-Sitzung ist abgelaufen. Bitte fordere einen neuen Link an.";
  }
  return "Das Passwort konnte nicht geändert werden. Bitte prüfe deine Eingabe oder fordere einen neuen Link an.";
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const { isPasswordRecovery, session } = useAuth();
  const recoveryLinkRef = useRef(getRecoveryLinkParams());
  const recoverySessionRef = useRef<Session | null>(null);
  const passwordUpdatedRef = useRef(false);
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("checking");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let recoveryEventReceived = false;

    if (passwordUpdatedRef.current) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active || event !== "PASSWORD_RECOVERY") return;
      recoveryEventReceived = true;
      recoverySessionRef.current = nextSession;
      setErrorMsg(null);
      setRecoveryState(nextSession ? "ready" : "invalid");
    });

    async function establishRecoverySession() {
      if (isPasswordRecovery && session) {
        recoverySessionRef.current = session;
        setRecoveryState("ready");
        return;
      }

      const recoveryLink = recoveryLinkRef.current;
      if (!recoveryLink?.hasRecoveryLink) {
        if (active) setRecoveryState("invalid");
        return;
      }

      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      if (!active || recoveryEventReceived) return;

      const matchesRecoveryHash =
        recoveryLink.hashType === "recovery" &&
        Boolean(recoveryLink.hashAccessToken && recoveryLink.hashRefreshToken) &&
        currentSession?.access_token === recoveryLink.hashAccessToken &&
        currentSession.refresh_token === recoveryLink.hashRefreshToken;

      if (currentSession && !sessionError && matchesRecoveryHash) {
        recoverySessionRef.current = currentSession;
        setRecoveryState("ready");
        return;
      }

      setErrorMsg(recoveryErrorMessage(sessionError));
      setRecoveryState("invalid");
    }

    void establishRecoverySession();
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [isPasswordRecovery, session]);

  async function finishRecoverySession() {
    setSubmitting(true);
    const { error } = await supabase.auth.signOut();
    setSubmitting(false);

    if (error) {
      setErrorMsg("Das Passwort wurde geändert, aber die Recovery-Sitzung konnte nicht beendet werden. Bitte versuche es erneut.");
      setRecoveryState("signOutError");
      return;
    }

    recoverySessionRef.current = null;
    setErrorMsg(null);
    setRecoveryState("success");
    window.setTimeout(() => router.replace("/?auth=login"), 1200);
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (recoveryState !== "ready" || !recoverySessionRef.current) {
      setErrorMsg("Deine Recovery-Sitzung ist nicht mehr gültig. Bitte fordere einen neuen Link an.");
      setRecoveryState("invalid");
      return;
    }
    if (!password) {
      setErrorMsg("Bitte gib ein neues Passwort ein.");
      return;
    }
    if (password.length < 8) {
      setErrorMsg("Dein Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    if (password !== passwordConfirm) {
      setErrorMsg("Die Passwörter stimmen nicht überein.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setSubmitting(false);
      setErrorMsg(updateErrorMessage(error));
      return;
    }

    passwordUpdatedRef.current = true;
    setSubmitting(false);
    await finishRecoverySession();
  }

  return (
    <main className="relative z-[6000] flex min-h-[100dvh] items-center bg-[#0f3b2e] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto w-full max-w-[420px] rounded-[28px] border border-white/10 bg-white/5 p-5 text-center sm:p-6">
        {recoveryState === "checking" ? (
          <><h1 className="text-2xl font-extrabold italic">Recovery-Link wird geprüft</h1><p className="mt-3 text-sm text-white/80">Einen Moment bitte. Wir bestätigen deinen sicheren Link.</p></>
        ) : recoveryState === "invalid" ? (
          <><h1 className="text-2xl font-extrabold italic">Recovery-Link ungültig</h1><p className="mt-3 text-sm text-white/80">{errorMsg ?? "Dieser Link ist abgelaufen, ungültig oder wurde bereits verwendet. Bitte fordere einen neuen Link an."}</p><Link href="/" className="mt-5 inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-[#e8decc] px-5 py-3 text-base font-semibold text-[#0f3b2e] transition hover:bg-[#ded3be]">Zurück zum Login</Link></>
        ) : recoveryState === "success" ? (
          <><h1 className="text-2xl font-extrabold italic">Passwort geändert</h1><p className="mt-3 text-sm text-white/80">Du wirst zum Login weitergeleitet und kannst dich dort mit deinem neuen Passwort anmelden.</p></>
        ) : recoveryState === "signOutError" ? (
          <><h1 className="text-2xl font-extrabold italic">Passwort geändert</h1><p role="alert" className="mt-3 text-sm text-red-300">{errorMsg}</p><button type="button" disabled={submitting} onClick={() => void finishRecoverySession()} className="mt-5 inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-[#e8decc] px-5 py-3 text-base font-semibold text-[#0f3b2e] transition hover:bg-[#ded3be] disabled:cursor-not-allowed disabled:opacity-70">{submitting ? "Melde ab …" : "Recovery-Sitzung beenden"}</button></>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold italic">Neues Passwort festlegen</h1>
            <p className="mt-3 text-sm text-white/80">Vergib ein neues Passwort mit mindestens 8 Zeichen.</p>
            <form onSubmit={handlePasswordReset} className="mt-5 space-y-3 text-left">
              <label className="block"><span className="sr-only">Neues Passwort</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-2xl border border-[#e7dfcf] bg-[#fffaf2] px-4 py-3 text-[16px] font-medium text-[#0f2a22] placeholder:text-[#0f2a22]/50 focus:outline-none focus:ring-2 focus:ring-[#c6a85b]" placeholder="Neues Passwort" autoComplete="new-password" minLength={8} required /></label>
              <label className="block"><span className="sr-only">Passwort bestätigen</span><input type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} className="w-full rounded-2xl border border-[#e7dfcf] bg-[#fffaf2] px-4 py-3 text-[16px] font-medium text-[#0f2a22] placeholder:text-[#0f2a22]/50 focus:outline-none focus:ring-2 focus:ring-[#c6a85b]" placeholder="Passwort bestätigen" autoComplete="new-password" minLength={8} required /></label>
              <button type="submit" disabled={submitting} className="inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-[#e8decc] px-5 py-3 text-base font-semibold text-[#0f3b2e] transition hover:bg-[#ded3be] disabled:cursor-not-allowed disabled:opacity-70">{submitting ? "Speichere …" : "Passwort speichern"}</button>
              {errorMsg ? <p role="alert" className="text-sm text-red-300">{errorMsg}</p> : null}
            </form>
          </>
        )}
      </div>
    </main>
  );
}
