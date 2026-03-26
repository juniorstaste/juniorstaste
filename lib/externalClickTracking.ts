"use client";

import { supabase } from "@/lib/supabaseClient";

export type ExternalButtonType = "maps" | "wolt" | "lieferando" | "ubereats";

type TrackExternalClickParams = {
  event?: React.MouseEvent<HTMLElement>;
  url: string;
  spotId: string;
  buttonType: ExternalButtonType;
};

export async function trackAndOpenExternalLink({
  event,
  url,
  spotId,
  buttonType,
}: TrackExternalClickParams) {
  event?.preventDefault();
  event?.stopPropagation();

  const newWindow = typeof window !== "undefined"
    ? window.open("", "_blank", "noopener,noreferrer")
    : null;

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

  if (newWindow) {
    newWindow.location.href = url;
    return;
  }

  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
