"use client";

import { supabase } from "@/lib/supabaseClient";

export type ExternalButtonType = "maps" | "wolt" | "lieferando" | "ubereats";

type TrackExternalClickParams = {
  event?: React.MouseEvent<HTMLElement>;
  url: string;
  spotId: string;
  buttonType: ExternalButtonType;
};

function isMobileExternalNavigation() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;

  const mobileUserAgent =
    /Android|iPhone|iPad|iPod|Mobile|CriOS|FxiOS|EdgiOS|SamsungBrowser/i.test(
      navigator.userAgent
    );

  const coarsePointer =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;

  return mobileUserAgent || coarsePointer;
}

export async function trackAndOpenExternalLink({
  event,
  url,
  spotId,
  buttonType,
}: TrackExternalClickParams) {
  event?.preventDefault();
  event?.stopPropagation();

  const shouldUseDirectNavigation = isMobileExternalNavigation();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("click_events").insert({
      user_id: user?.id ?? null,
      spot_id: spotId,
      button_type: buttonType,
    });

    if (error) {
      console.error("Konnte Click-Event nicht speichern:", error);
    }
  } catch (error) {
    console.error("Fehler beim Click-Tracking:", error);
  }

  if (typeof window === "undefined") return;

  if (shouldUseDirectNavigation) {
    window.location.href = url;
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}
