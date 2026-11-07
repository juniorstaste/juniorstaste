"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PaperPlaneTilt } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { sendSpotMessage, startConversation } from "@/lib/messaging";
import { queueConversationAfterInbox, rememberMessagesOrigin } from "@/lib/messageNavigation";

type Props = {
  spotId: string;
  spotName: string;
  variant?: "detail" | "list" | "list-light" | "video" | "video-large";
};

function ShareIcon({ variant }: { variant: "detail" | "list" | "list-light" }) {
  const strokeColor = variant === "list" ? "#0f3b2e" : "white";

  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke={strokeColor}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13 5l6 6-6 6" />
      <path d="M19 11H9.5C7 11 5 13 5 15.5V19" />
    </svg>
  );
}

export default function ShareSpotButton({
  spotId,
  spotName,
  variant = "detail",
}: Props) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState<{ id: string; display_name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const { user, openAuthPrompt } = useAuth();
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !user) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      if (!query.trim()) {
        setLoading(false);
        setProfiles([]);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase.rpc("search_message_profiles", { search_text: query });
      if (!active) return;
      setProfiles((data ?? []) as { id: string; display_name: string }[]);
      setSearchError(Boolean(error));
      setLoading(false);
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [open, query, user]);

  const buttonClass =
    variant === "detail"
      ? "relative z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 transition hover:bg-white/15"
      : variant === "list-light"
      ? "relative z-20 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 transition hover:bg-white/15"
      : variant === "video"
      ? "inline-flex h-10 w-10 items-center justify-center text-white"
      : variant === "video-large"
      ? "inline-flex h-11 w-11 items-center justify-center text-white"
      : "relative z-20 inline-flex h-8 w-8 items-center justify-center transition";

  async function handleShare(e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();

    if (typeof window === "undefined") return;
    if (variant !== "video" && variant !== "video-large") {
      await handleExternalShare();
      return;
    }
    if (!user) {
      openAuthPrompt();
      return;
    }
    setOpen(true);
  }

  async function handleExternalShare() {
    if (typeof window === "undefined") return;

    const url = `${window.location.origin}/spot/${spotId}`;
    const shareData = {
      title: spotName,
      text: `Schau dir ${spotName} bei Junior's Taste an.`,
      url,
    };

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        if (typeof navigator.canShare !== "function" || navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
      }

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setFeedback("Link kopiert");
        window.setTimeout(() => setFeedback(null), 1600);
        return;
      }

      window.prompt("Link kopieren:", url);
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return;
      console.error("Teilen fehlgeschlagen:", error);
    }
  }

  async function handleSend(profileId: string) {
    if (!user || sendingTo) return;
    setSendingTo(profileId);
    try {
      const conversationId = await startConversation(profileId);
      await sendSpotMessage(conversationId, user.id, spotId);
      setOpen(false);
      rememberMessagesOrigin();
      queueConversationAfterInbox(conversationId);
      router.push("/messages");
    } catch (error) {
      console.error("Spot konnte nicht gesendet werden:", error);
      setFeedback("Senden fehlgeschlagen");
      window.setTimeout(() => setFeedback(null), 1800);
    } finally {
      setSendingTo(null);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleShare}
        onPointerDown={variant === "video" || variant === "video-large" ? (event) => event.stopPropagation() : undefined}
        onPointerUp={variant === "video" || variant === "video-large" ? (event) => event.stopPropagation() : undefined}
        className={buttonClass}
        aria-label={variant === "video" || variant === "video-large" ? "Spot an Nutzer senden" : "Spot teilen"}
        title={variant === "video" || variant === "video-large" ? "Spot an Nutzer senden" : "Spot teilen"}
      >
        {variant === "video" || variant === "video-large" ? (
          <PaperPlaneTilt size={variant === "video-large" ? 30 : 26} weight="fill" aria-hidden="true" />
        ) : (
          <ShareIcon variant={variant} />
        )}
      </button>

      {feedback ? (
        <div className="absolute right-0 top-full mt-2 whitespace-nowrap rounded-lg bg-[#0f3b2e] px-2 py-1 text-[11px] font-semibold text-white shadow-lg">
          {feedback}
        </div>
      ) : null}

      {mounted && open ? createPortal(
        <div className="fixed inset-0 z-[4500] flex items-end justify-center sm:items-center">
          <button type="button" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/45" aria-label="Senden schließen" />
          <div className="relative max-h-[78vh] w-full max-w-md overflow-hidden rounded-t-[28px] bg-[#f6efe3] shadow-2xl sm:rounded-[28px]">
            <div className="flex items-center justify-between border-b border-[#d8ccb7] px-5 py-4">
              <div><h2 className="font-extrabold text-[#0f3b2e]">Spot senden</h2><p className="mt-0.5 max-w-[260px] truncate text-xs text-[#0f3b2e]/60">{spotName}</p></div>
              <button type="button" onClick={() => setOpen(false)} className="text-3xl leading-none text-[#0f3b2e]" aria-label="Schließen">×</button>
            </div>
            <div className="p-4">
              <input value={query} onChange={(event) => { setQuery(event.target.value); setProfiles([]); setSearchError(false); }} placeholder="Username suchen…" autoFocus className="w-full rounded-2xl border border-[#d8ccb7] bg-white px-4 py-3 text-sm text-[#0f3b2e] outline-none focus:border-[#0f3b2e]" />
              <div className="mt-3 max-h-[42vh] space-y-1 overflow-y-auto">
                {loading ? <p className="py-6 text-center text-sm text-[#0f3b2e]/60">Nutzer werden geladen…</p> : null}
                {!loading && searchError ? <p className="py-6 text-center text-sm text-[#b33a2b]">Suche fehlgeschlagen. Bitte versuche es erneut.</p> : null}
                {!loading && !searchError && profiles.length === 0 ? <p className="py-6 text-center text-sm text-[#0f3b2e]/60">{query.trim() ? "Kein Username gefunden." : "Gib einen Username ein."}</p> : null}
                {profiles.map((profile) => <button key={profile.id} type="button" disabled={Boolean(sendingTo)} onClick={() => void handleSend(profile.id)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[#0f3b2e] transition hover:bg-white disabled:opacity-50"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0f3b2e] font-bold text-white">{profile.display_name.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1 truncate font-semibold">{profile.display_name}</span><span className="text-sm">{sendingTo === profile.id ? "Wird gesendet…" : "Senden"}</span></button>)}
              </div>
              <button type="button" onClick={() => void handleExternalShare()} className="mt-3 w-full rounded-2xl border border-[#d8ccb7] px-4 py-3 text-sm font-semibold text-[#0f3b2e]">Über andere Apps teilen</button>
            </div>
          </div>
        </div>, document.body) : null}
    </div>
  );
}
