"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { authLoading, user } = useAuth();

  useEffect(() => {
    if (authLoading) return;

    const timeoutId = window.setTimeout(() => {
      router.replace(user ? "/" : "/");
    }, 1200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [authLoading, router, user]);

  return (
    <main className="min-h-screen bg-[#0f3b2e] px-6 py-10 text-white">
      <div className="mx-auto max-w-[420px] rounded-[28px] border border-white/10 bg-white/5 p-6 text-center">
        <h1 className="text-2xl font-extrabold italic">Anmeldung wird abgeschlossen</h1>
        <p className="mt-3 text-sm text-white/80">
          Einen Moment bitte. Wir leiten dich gleich weiter.
        </p>
      </div>
    </main>
  );
}
