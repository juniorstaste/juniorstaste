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

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isAndroidDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

function stripHttpScheme(url: string) {
  return url.replace(/^https?:\/\//i, "");
}

function isGoogleMapsUrl(url: string) {
  return /^https?:\/\/((www|maps)\.)?google\.[^/]+\/maps/i.test(url);
}

function buildMobileNavigationTarget(buttonType: ExternalButtonType, url: string) {
  if (buttonType !== "maps") {
    return { primaryUrl: url, fallbackUrl: null as string | null };
  }

  if (!isGoogleMapsUrl(url)) {
    return { primaryUrl: url, fallbackUrl: null as string | null };
  }

  if (isIosDevice()) {
    return {
      primaryUrl: `comgooglemapsurl://${stripHttpScheme(url)}`,
      fallbackUrl: url,
    };
  }

  if (isAndroidDevice()) {
    return {
      primaryUrl: `intent://${stripHttpScheme(
        url
      )}#Intent;scheme=https;package=com.google.android.apps.maps;end`,
      fallbackUrl: url,
    };
  }

  return { primaryUrl: url, fallbackUrl: null as string | null };
}

async function trackExternalClick(spotId: string, buttonType: ExternalButtonType) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("click_events").insert({
    user_id: user?.id ?? null,
    spot_id: spotId,
    button_type: buttonType,
  });

  if (error) {
    console.error("Konnte Click-Event nicht speichern:", {
      error,
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
  }
}

function navigateOnMobile(buttonType: ExternalButtonType, url: string) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const { primaryUrl, fallbackUrl } = buildMobileNavigationTarget(buttonType, url);

  if (!fallbackUrl || fallbackUrl === primaryUrl) {
    window.location.href = primaryUrl;
    return;
  }

  let fallbackUsed = false;

  const cleanup = () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("pagehide", handlePageHide);
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      cleanup();
    }
  };

  const handlePageHide = () => {
    cleanup();
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pagehide", handlePageHide, { once: true });

  window.location.href = primaryUrl;

  window.setTimeout(() => {
    if (fallbackUsed || document.visibilityState === "hidden") return;
    fallbackUsed = true;
    cleanup();
    window.location.href = fallbackUrl;
  }, 1200);
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
    await Promise.race([
      trackExternalClick(spotId, buttonType),
      new Promise((resolve) => window.setTimeout(resolve, 350)),
    ]);
  } catch (error) {
    console.error("Fehler beim Click-Tracking:", error);
  }

  if (typeof window === "undefined") return;

  if (shouldUseDirectNavigation) {
    navigateOnMobile(buttonType, url);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}
