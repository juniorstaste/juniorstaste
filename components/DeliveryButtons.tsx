"use client";

import type { CSSProperties, SyntheticEvent } from "react";
import type { ExternalButtonType } from "@/lib/externalClickTracking";
import { trackAndOpenExternalLink } from "@/lib/externalClickTracking";

type Props = {
  spotId: string;
  uberEatsUrl?: string | null;
  woltUrl?: string | null;
  lieferandoUrl?: string | null;
  buttonClassName?: string;
  buttonStyle?: CSSProperties;
  variant?: "default" | "saved" | "for-you";
};

const defaultButtonClassName =
  // TODO: Logos spaeter ueber /public/logos/ einbinden (nur lokale Dateien verwenden, keine externen).
  // Eigene Logos spaeter in /public/logos/ speichern, bevorzugt als SVG, alternativ als PNG.
  // Im Button dann statt des Textes ein lokales <img src="/logos/datei.svg" className="w-full h-full object-contain" /> rendern.
  "rounded-xl border border-[#e7dfcf] bg-[#fffaf2] px-4 py-2.5 text-[15px] font-semibold " +
  "text-[#1f1f1f] shadow-sm transition hover:bg-[#f6efe3]";

export default function DeliveryButtons({
  spotId,
  uberEatsUrl,
  woltUrl,
  lieferandoUrl,
  buttonClassName,
  buttonStyle,
  variant = "default",
}: Props) {
  type DeliveryService = {
    buttonType: ExternalButtonType;
    label: string;
    logoSrc: string;
    fallbackLogoSrc: string;
    url?: string | null;
  };

  const defaultServices: DeliveryService[] = [
    {
      buttonType: "wolt",
      label: "Wolt",
      logoSrc: "/logos/wolt.png",
      fallbackLogoSrc: "/logos/wolt.png",
      url: woltUrl,
    },
    {
      buttonType: "lieferando",
      label: "Lieferando",
      logoSrc: "/logos/lieferando.png",
      fallbackLogoSrc: "/logos/lieferando.png",
      url: lieferandoUrl,
    },
    {
      buttonType: "ubereats",
      label: "Uber Eats",
      logoSrc: "/logos/ubereats.png",
      fallbackLogoSrc: "/logos/ubereats.png",
      url: uberEatsUrl,
    },
  ];

  const savedServices: DeliveryService[] = [
    {
      buttonType: "ubereats",
      label: "Uber Eats",
      logoSrc: "/logos/delivery/uber-eats.svg",
      fallbackLogoSrc: "/logos/ubereats.png",
      url: uberEatsUrl,
    },
    {
      buttonType: "wolt",
      label: "Wolt",
      logoSrc: "/logos/delivery/wolt.png",
      fallbackLogoSrc: "/logos/wolt.png",
      url: woltUrl,
    },
    {
      buttonType: "lieferando",
      label: "Lieferando",
      logoSrc: "/logos/delivery/lieferando.png",
      fallbackLogoSrc: "/logos/lieferando.png",
      url: lieferandoUrl,
    },
  ];

  const isSavedVariant = variant === "saved";
  const services = isSavedVariant
    ? savedServices
    : variant === "for-you"
      ? [defaultServices[2], defaultServices[1], defaultServices[0]]
      : defaultServices;

  function handleLogoError(
    event: SyntheticEvent<HTMLImageElement>,
    fallbackLogoSrc: string
  ) {
    const image = event.currentTarget;
    if (image.dataset.fallbackApplied === "true") return;

    image.dataset.fallbackApplied = "true";
    image.src = fallbackLogoSrc;
  }

  return (
    <>
      {services.map((service) => {
        if (!service.url) return null;

        return (
          <a
            key={service.buttonType}
            href={service.url}
            target="_blank"
            rel="noreferrer"
            onClick={(event) =>
              void trackAndOpenExternalLink({
                event,
                url: service.url!,
                spotId,
                buttonType: service.buttonType,
              })
            }
            className={
              buttonClassName ??
              (isSavedVariant
                ? "inline-flex h-5 shrink-0 items-center justify-center"
                : defaultButtonClassName)
            }
            style={buttonStyle}
            aria-label={service.label}
            title={service.label}
          >
            <img
              src={service.logoSrc}
              alt={service.label}
              className={
                isSavedVariant
                  ? "h-5 w-auto max-w-full object-contain"
                  : "h-full max-h-5 w-full object-contain"
              }
              onError={(event) => handleLogoError(event, service.fallbackLogoSrc)}
            />
          </a>
        );
      })}
    </>
  );
}
