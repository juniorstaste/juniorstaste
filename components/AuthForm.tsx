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
  if (message.toLowerCase().includes("email not confirmed")) {
    return "Bitte bestaetige zuerst die E-Mail in deinem Postfach.";
  }

  if (message.toLowerCase().includes("invalid login credentials")) {
    return "Diese Anmeldedaten konnten wir nicht zuordnen.";
  }

  if (message.toLowerCase().includes("user not found")) {
    return "Zu dieser E-Mail gibt es noch kein Konto.";
  }

  return message;
}

export default function AuthForm({
  mode = "drawer",
  initialView = "signup",
  onSuccess,
}: Props) {
  const [view, setView] = useState<"signup" | "login">(initialView);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
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

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const emailRedirectTo = getAuthRedirectUrl();

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        emailRedirectTo,
        shouldCreateUser: view === "signup",
        data:
          view === "signup"
            ? {
                display_name: trimmedName,
              }
            : undefined,
      },
    });

    setSubmitting(false);

    if (error) {
      setErrorMsg(normalizeAuthError(error.message));
      setSuccessMsg(null);
      return;
    }

    setSuccessMsg(
      view === "signup"
        ? "Dein Konto wird vorbereitet. Pruefe jetzt deine E-Mails und bestaetige den Link."
        : "Wir haben dir einen Login-Link per E-Mail geschickt."
    );
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
          : "Für bestehende Konten senden wir einen sicheren Login-Link per E-Mail."}
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

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-2xl bg-[#0f3b2e] px-4 py-3 text-[15px] font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting
          ? "Sende Link..."
          : view === "signup"
          ? "Konto erstellen"
          : "Login-Link senden"}
      </button>

      {errorMsg ? <p className="text-sm text-red-700">{errorMsg}</p> : null}
      {successMsg ? <p className="text-sm text-[#0f3b2e]">{successMsg}</p> : null}
    </form>
  );
}
