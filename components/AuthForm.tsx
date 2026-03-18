"use client";

import { FormEvent, useMemo, useState } from "react";
import { getAuthRedirectUrl } from "@/lib/authRedirect";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  mode?: "drawer" | "modal";
  initialView?: "signup" | "login";
  onSuccess?: () => void;
};

function normalizeAuthError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("email not confirmed")) {
    return "Bitte bestaetige zuerst deine E-Mail-Adresse.";
  }

  if (normalized.includes("invalid login credentials")) {
    return "E-Mail oder Passwort stimmen nicht.";
  }

  if (normalized.includes("user not found")) {
    return "Zu dieser E-Mail gibt es noch kein Konto.";
  }

  if (normalized.includes("password")) {
    return "Bitte pruefe dein Passwort und versuche es erneut.";
  }

  return message;
}

type AuthView = "signup" | "login" | "forgotPassword";

export default function AuthForm({
  mode = "drawer",
  initialView = "signup",
  onSuccess,
}: Props) {
  const [view, setView] = useState<AuthView>(initialView);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const inputClass = useMemo(() => {
    return mode === "modal"
      ? "w-full rounded-2xl border border-[#e7dfcf] bg-[#fffaf2] px-4 py-3 text-[15px] font-medium text-[#0f2a22] placeholder:text-[#0f2a22]/50 focus:outline-none focus:ring-2 focus:ring-[#c6a85b]"
      : "w-full rounded-2xl border border-[#d8ccb7] bg-[#fffaf2] px-4 py-3 text-[15px] font-medium text-[#0f2a22] placeholder:text-[#0f2a22]/50 focus:outline-none focus:ring-2 focus:ring-[#c6a85b]";
  }, [mode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    const trimmedPassword = password.trim();
    const trimmedPasswordConfirm = passwordConfirm.trim();

    if (view === "signup" && !trimmedName) {
      setErrorMsg("Bitte gib deinen Namen ein.");
      setSuccessMsg(null);
      return;
    }

    if (!trimmedEmail) {
      setErrorMsg("Bitte gib deine E-Mail-Adresse ein.");
      setSuccessMsg(null);
      return;
    }

    if (view !== "forgotPassword" && !trimmedPassword) {
      setErrorMsg("Bitte gib dein Passwort ein.");
      setSuccessMsg(null);
      return;
    }

    if (view === "signup" && trimmedPassword.length < 8) {
      setErrorMsg("Dein Passwort sollte mindestens 8 Zeichen lang sein.");
      setSuccessMsg(null);
      return;
    }

    if (view === "signup" && trimmedPassword !== trimmedPasswordConfirm) {
      setErrorMsg("Die Passwoerter stimmen nicht ueberein.");
      setSuccessMsg(null);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const emailRedirectTo = getAuthRedirectUrl();
    let error: { message: string } | null = null;

    if (view === "signup") {
      const result = await supabase.auth.signUp({
        email: trimmedEmail,
        password: trimmedPassword,
        options: {
          emailRedirectTo,
          data: {
            display_name: trimmedName,
          },
        },
      });

      error = result.error;
    } else if (view === "login") {
      const result = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      error = result.error;
    } else {
      const result = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: getAuthRedirectUrl("/reset-password"),
      });

      error = result.error;
    }

    setSubmitting(false);

    if (error) {
      setErrorMsg(normalizeAuthError(error.message));
      setSuccessMsg(null);
      return;
    }

    if (view === "signup") {
      setSuccessMsg(
        "Dein Konto wurde erstellt. Bitte bestaetige jetzt die E-Mail in deinem Postfach."
      );
    } else if (view === "login") {
      setSuccessMsg("Du bist jetzt eingeloggt.");
    } else {
      setSuccessMsg(
        "Wir haben dir eine E-Mail zum Zuruecksetzen deines Passworts geschickt."
      );
    }

    setErrorMsg(null);
    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#eadfcd] p-1">
        <button
          type="button"
          onClick={() => {
            setView("login");
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
            view === "login"
              ? "bg-[#0f3b2e] text-white"
              : "text-[#0f3b2e] hover:bg-white/40"
          }`}
        >
          Einloggen
        </button>

        <button
          type="button"
          onClick={() => {
            setView("signup");
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
            view === "signup"
              ? "bg-[#0f3b2e] text-white"
              : "text-[#0f3b2e] hover:bg-white/40"
          }`}
        >
          Konto erstellen
        </button>
      </div>

      <div className="text-sm text-[#0f3b2e]/80">
        {view === "signup"
          ? "Erstelle dein Konto mit Name und E-Mail. Danach bestaetigst du den Link in deinem Postfach."
          : view === "login"
          ? "Logge dich mit deiner E-Mail-Adresse und deinem Passwort ein."
          : "Gib deine E-Mail-Adresse ein. Wir schicken dir einen Link zum Zuruecksetzen deines Passworts."}
      </div>

      {view === "signup" ? (
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={inputClass}
          placeholder="Name"
          autoComplete="name"
        />
      ) : null}

      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className={inputClass}
        placeholder="E-Mail-Adresse"
        autoComplete="email"
      />

      {view !== "forgotPassword" ? (
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={inputClass}
          placeholder="Passwort"
          autoComplete={view === "signup" ? "new-password" : "current-password"}
        />
      ) : null}

      {view === "signup" ? (
        <input
          type="password"
          value={passwordConfirm}
          onChange={(event) => setPasswordConfirm(event.target.value)}
          className={inputClass}
          placeholder="Passwort wiederholen"
          autoComplete="new-password"
        />
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-2xl bg-[#0f3b2e] px-4 py-3 text-[15px] font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting
          ? "Sende..."
          : view === "signup"
          ? "Konto erstellen"
          : view === "login"
          ? "Einloggen"
          : "Passwort zuruecksetzen"}
      </button>

      {view === "login" ? (
        <button
          type="button"
          onClick={() => {
            setView("forgotPassword");
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className="w-full text-sm font-semibold text-[#0f3b2e] transition hover:opacity-75"
        >
          Passwort vergessen?
        </button>
      ) : null}

      {view === "forgotPassword" ? (
        <button
          type="button"
          onClick={() => {
            setView("login");
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className="w-full text-sm font-semibold text-[#0f3b2e] transition hover:opacity-75"
        >
          Zurueck zum Login
        </button>
      ) : null}

      {errorMsg ? <p className="text-sm text-red-700">{errorMsg}</p> : null}
      {successMsg ? <p className="text-sm text-[#0f3b2e]">{successMsg}</p> : null}
    </form>
  );
}
