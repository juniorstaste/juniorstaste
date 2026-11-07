"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthRedirectUrl } from "@/lib/authRedirect";
import { logSupabaseError } from "@/lib/logSupabaseError";
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

function isExistingEmailError(error: { message: string; code?: string }) {
  const normalized = `${error.code ?? ""} ${error.message}`.toLowerCase();
  return (
    error.code === "user_already_exists" ||
    normalized.includes("user already registered") ||
    normalized.includes("email already registered") ||
    normalized.includes("email address already registered") ||
    normalized.includes("email_exists")
  );
}

type AuthView = "signup" | "login" | "forgotPassword";

export default function AuthForm({
  mode = "drawer",
  initialView = "signup",
  onSuccess,
}: Props) {
  const router = useRouter();
  const [view, setView] = useState<AuthView>(initialView);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const inputClass = useMemo(() => {
    return mode === "modal"
      ? "w-full rounded-2xl border border-[#e7dfcf] bg-[#fffaf2] px-4 py-3 text-[15px] font-medium text-[#0f2a22] placeholder:text-[#0f2a22]/50 focus:outline-none focus:ring-2 focus:ring-[#c6a85b]"
      : "w-full rounded-2xl border border-[#d8ccb7] bg-[#fffaf2] px-4 py-3 text-[15px] font-medium text-[#0f2a22] placeholder:text-[#0f2a22]/50 focus:outline-none focus:ring-2 focus:ring-[#c6a85b]";
  }, [mode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim();
    const trimmedPassword = password;
    const trimmedPasswordConfirm = passwordConfirm;

    if (view === "signup" && !trimmedUsername) {
      setUsernameError("Bitte gib deinen Username ein.");
      setEmailError(null);
      setErrorMsg(null);
      setSuccessMsg(null);
      setInfoMsg(null);
      return;
    }

    if (view === "signup" && (trimmedUsername.length > 100 || trimmedUsername.includes("@"))) {
      setUsernameError("Der Username darf höchstens 100 Zeichen enthalten und kein @-Zeichen haben.");
      setEmailError(null);
      setErrorMsg(null);
      setSuccessMsg(null);
      setInfoMsg(null);
      return;
    }

    if (!trimmedEmail) {
      setUsernameError(null);
      setEmailError(view === "signup" ? "Bitte gib deine E-Mail-Adresse ein." : null);
      setErrorMsg(view === "login" ? "Bitte gib deine E-Mail-Adresse oder deinen Username ein." : null);
      setSuccessMsg(null);
      setInfoMsg(null);
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
    setInfoMsg(null);
    setUsernameError(null);
    setEmailError(null);

    const emailRedirectTo = getAuthRedirectUrl();
    let error: { message: string; code?: string } | null = null;
    let hasSession = false;

    if (view === "signup") {
      const { data: usernameAvailable, error: availabilityError } = await supabase.rpc(
        "is_username_available",
        { candidate_username: trimmedUsername }
      );

      if (availabilityError) {
        logSupabaseError("Konnte Username-Verfügbarkeit nicht prüfen:", availabilityError);
        setSubmitting(false);
        setErrorMsg("Der Username kann gerade nicht geprüft werden. Bitte versuche es erneut.");
        return;
      }

      if (usernameAvailable !== true) {
        setSubmitting(false);
        setUsernameError("Dieser Benutzername ist bereits vergeben.");
        return;
      }

      const result = await supabase.auth.signUp({
        email: trimmedEmail,
        password: trimmedPassword,
        options: {
          emailRedirectTo,
          data: {
            username: trimmedUsername,
            display_name: trimmedUsername,
          },
        },
      });

      error = result.error;
      hasSession = Boolean(result.data.session);
    } else if (view === "login") {
      if (trimmedEmail.includes("@")) {
        const result = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password: trimmedPassword,
        });
        error = result.error;
        hasSession = Boolean(result.data.session);
      } else {
        try {
          const response = await fetch("/api/auth/username-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: trimmedEmail, password: trimmedPassword }),
            cache: "no-store",
          });
          const result = await response.json();
          if (!response.ok) {
            error = { message: result.error ?? "Anmeldung fehlgeschlagen." };
          } else {
            const sessionResult = await supabase.auth.setSession(result);
            error = sessionResult.error;
            hasSession = Boolean(sessionResult.data.session);
          }
        } catch {
          error = { message: "Anmeldung fehlgeschlagen. Bitte versuche es erneut." };
        }
      }
    } else {
      const result = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: getAuthRedirectUrl("/reset-password"),
      });

      error = result.error;
    }

    if (error) {
      if (view === "signup" && isExistingEmailError(error)) {
        setSubmitting(false);
        setEmailError("Unter dieser E-Mail-Adresse existiert bereits ein Konto.");
        setErrorMsg(null);
        return;
      }

      if (view === "signup") {
        const { data: usernameStillAvailable, error: availabilityError } = await supabase.rpc(
          "is_username_available",
          { candidate_username: trimmedUsername }
        );

        if (availabilityError) {
          logSupabaseError("Konnte Username nach Signup-Fehler nicht erneut prüfen:", availabilityError);
        } else if (usernameStillAvailable === false) {
          setSubmitting(false);
          setUsernameError("Dieser Benutzername ist bereits vergeben.");
          return;
        }
      }

      setSubmitting(false);
      setErrorMsg(
        view === "signup" && /database error saving new user/i.test(error.message)
          ? "Konto konnte nicht erstellt werden. Bitte versuche es erneut."
          : normalizeAuthError(error.message)
      );
      setSuccessMsg(null);
      setInfoMsg(null);
      return;
    }

    setSubmitting(false);

    if (view === "signup" && hasSession) {
      setSuccessMsg("Du bist jetzt eingeloggt.");
      setErrorMsg(null);
      onSuccess?.();
      router.replace("/for-you");
      return;
    }

    if (view === "signup") {
      setInfoMsg(
        "Falls unter dieser E-Mail-Adresse bereits ein Konto existiert, melde dich bitte an oder setze dein Passwort zurück. Wenn du dich neu registriert hast, prüfe dein Postfach auf den Bestätigungslink."
      );
    } else if (view === "login") {
      setSuccessMsg("Du bist jetzt eingeloggt.");
      setErrorMsg(null);
      onSuccess?.();
      router.replace("/for-you");
      return;
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
            setInfoMsg(null);
            setUsernameError(null);
            setEmailError(null);
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
            setInfoMsg(null);
            setUsernameError(null);
            setEmailError(null);
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
          ? "Erstelle dein Konto mit Username und E-Mail. Danach bestaetigst du den Link in deinem Postfach."
          : view === "login"
          ? "Logge dich mit deiner E-Mail-Adresse oder deinem Username und deinem Passwort ein."
          : "Gib deine E-Mail-Adresse ein. Wir schicken dir einen Link zum Zuruecksetzen deines Passworts."}
      </div>

      {view === "signup" ? (
        <div className="space-y-1">
          <input
            id="signup-username"
            name="username"
            type="text"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              setUsernameError(null);
              setErrorMsg(null);
              setInfoMsg(null);
            }}
            maxLength={100}
            className={inputClass}
            placeholder="Username"
            autoComplete="username"
            aria-invalid={Boolean(usernameError)}
            aria-describedby={usernameError ? "signup-username-error" : undefined}
          />
          {usernameError ? (
            <p id="signup-username-error" className="text-sm text-red-700">
              {usernameError}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1">
        <input
          id={view === "login" ? "login-identifier" : "signup-email"}
          name={view === "login" ? "username" : "email"}
          type={view === "login" ? "text" : "email"}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setEmailError(null);
            setErrorMsg(null);
            setInfoMsg(null);
          }}
          className={inputClass}
          placeholder={view === "login" ? "E-Mail oder Username" : "E-Mail-Adresse"}
          autoComplete="username"
          aria-invalid={Boolean(emailError)}
          aria-describedby={emailError ? "signup-email-error" : undefined}
        />
        {emailError ? (
          <p id="signup-email-error" className="text-sm text-red-700">
            {emailError}
          </p>
        ) : null}
      </div>

      {view !== "forgotPassword" ? (
        <input
          id={view === "login" ? "login-password" : "signup-password"}
          name={view === "signup" ? "new-password" : "password"}
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
          id="signup-password-confirm"
          name="new-password-confirm"
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
            setInfoMsg(null);
            setUsernameError(null);
            setEmailError(null);
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
            setInfoMsg(null);
            setUsernameError(null);
            setEmailError(null);
          }}
          className="w-full text-sm font-semibold text-[#0f3b2e] transition hover:opacity-75"
        >
          Zurueck zum Login
        </button>
      ) : null}

      {errorMsg ? <p className="text-sm text-red-700">{errorMsg}</p> : null}
      {successMsg ? <p className="text-sm text-[#0f3b2e]">{successMsg}</p> : null}
      {infoMsg ? <p className="text-sm text-[#0f3b2e]/80">{infoMsg}</p> : null}
    </form>
  );
}
