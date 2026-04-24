"use client";

import type { CSSProperties } from "react";
import type { ExternalButtonType } from "@/lib/externalClickTracking";
import { trackAndOpenExternalLink } from "@/lib/externalClickTracking";

type Props = {
  spotId: string;
  uberEatsUrl?: string | null;
  woltUrl?: string | null;
  lieferandoUrl?: string | null;
  buttonClassName?: string;
  buttonStyle?: CSSProperties;
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
}: Props) {
  const services: Array<{
    buttonType: ExternalButtonType;
    label: string;
    logoSrc: string;
    url?: string | null;
  }> = [
    {
      buttonType: "wolt",
      label: "Wolt",
      logoSrc: "/logos/wolt.png",
      url: woltUrl,
    },
    {
      buttonType: "lieferando",
      label: "Lieferando",
      logoSrc: "/logos/lieferando.png",
      url: lieferandoUrl,
    },
    {
      buttonType: "ubereats",
      label: "Uber Eats",
      logoSrc: "/logos/ubereats.png",
      url: uberEatsUrl,
    },
  ];

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
            className={buttonClassName ?? defaultButtonClassName}
            style={buttonStyle}
            aria-label={service.label}
            title={service.label}
          >
            <img
              src={service.logoSrc}
              alt={service.label}
              className="h-full w-full object-contain max-h-5"
            />
          </a>
        );
      })}
    </>
  );
}
