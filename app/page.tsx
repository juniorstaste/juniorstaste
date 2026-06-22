"use client";

import { useEffect, useState } from "react";
import AuthForm from "@/components/AuthForm";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

function AppleIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.5 2.2c0 1.2-.5 2.3-1.3 3.1-.8.9-2 1.5-3.1 1.4-.1-1.1.4-2.3 1.2-3.1.8-.9 2.1-1.5 3.2-1.4ZM20.4 17.4c-.5 1.2-.8 1.7-1.5 2.7-1 1.5-2.4 3.3-4.1 3.3-1.5 0-1.9-1-3.9-1s-2.5 1-3.9 1c-1.7 0-3-1.7-4.1-3.2C.1 16 .6 11.1 4 9.1c1.2-.7 2.7-1.1 4.1-1.1 1.5 0 2.9 1 3.8 1 .9 0 2.6-1.2 4.4-1 1.4.1 3.3.6 4.5 2.4-3.9 2.1-3.3 7.5-.4 9Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9c-.3 1.3-1 2.4-2.1 3.2v2.6h3.4c2-1.8 3.4-4.5 3.4-7.8Z" />
      <path fill="#34A853" d="M12 23c2.9 0 5.3-.9 7.1-2.6l-3.4-2.6c-.9.6-2.1 1-3.7 1-2.8 0-5.1-1.9-6-4.4H2.5v2.7C4.3 20.6 7.9 23 12 23Z" />
      <path fill="#FBBC05" d="M6 14.4c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.7H2.5C1.8 9.1 1.4 10.7 1.4 12.4s.4 3.3 1.1 4.7L6 14.4Z" />
      <path fill="#EA4335" d="M12 6c1.6 0 3 .6 4.1 1.6l3-3C17.3 2.9 14.9 2 12 2 7.9 2 4.3 4.4 2.5 7.7L6 10.4C6.9 7.9 9.2 6 12 6Z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.5 6.5h15a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16V8a1.5 1.5 0 0 1 1.5-1.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="m4 8 8 5 8-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Home() {
  const [emailOpen, setEmailOpen] = useState(false);
  const { authLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/for-you");
    }
  }, [authLoading, router, user]);

  const socialButtonClass =
    "flex h-[54px] w-full items-center rounded-2xl border border-[#dacdb9] bg-[#fffaf2] px-4 text-[15px] font-semibold text-[#0f2a22] shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55";

  if (authLoading || user) {
    return <main className="min-h-screen w-full bg-[#0f3b2e]" />;
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#0f3b2e] px-4 pb-8 pt-[calc(env(safe-area-inset-top)+0.5rem)] text-white sm:px-5">
      <div className="mx-auto w-full max-w-[560px]">
        <section className="relative -mx-4 min-h-[clamp(250px,38vh,320px)] overflow-hidden px-4 pb-1 pt-0 sm:mx-0 sm:px-0">
          <div className="absolute inset-0">
            <img
              src="/logo-juniors-taste-primary.png"
              alt=""
              aria-hidden="true"
              className="absolute left-1/2 top-[18%] w-[min(96vw,560px)] -translate-x-1/2 sm:top-[12%]"
            />
          </div>

          <div className="relative z-10 pb-0 pt-[clamp(108px,23vw,138px)]" />
        </section>

        <section className="mx-auto mt-0 w-full max-w-[420px] rounded-[28px] border border-white/12 bg-[#e8decc] p-4 text-[#0f3b2e] shadow-[0_18px_54px_rgba(5,18,14,0.24)]">
          <div className="space-y-3">
            <button type="button" disabled className={socialButtonClass}>
              <span className="flex h-6 w-8 items-center justify-start text-[#0f2a22]">
                <AppleIcon />
              </span>
              <span className="flex-1 text-center">Mit Apple anmelden</span>
              <span className="w-8" aria-hidden="true" />
            </button>

            <button type="button" disabled className={socialButtonClass}>
              <span className="flex h-6 w-8 items-center justify-start">
                <GoogleIcon />
              </span>
              <span className="flex-1 text-center">Mit Google anmelden</span>
              <span className="w-8" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => setEmailOpen((current) => !current)}
              className={socialButtonClass}
              aria-expanded={emailOpen}
            >
              <span className="flex h-6 w-8 items-center justify-start text-[#0f2a22]">
                <MailIcon />
              </span>
              <span className="flex-1 text-center">Mit E-Mail-Adresse anmelden</span>
              <span className="w-8" aria-hidden="true" />
            </button>
          </div>

          {emailOpen ? (
            <div className="mt-4 border-t border-[#d8ccb7] pt-4">
              <AuthForm mode="drawer" initialView="login" />
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
