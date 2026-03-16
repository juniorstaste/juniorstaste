"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type MenuItem = {
  label: string;
  href: string;
  icon: ReactNode;
};

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 7H19" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 12H19" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 17H19" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SavedSpotsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 4.75C6 4.06 6.56 3.5 7.25 3.5H16.75C17.44 3.5 18 4.06 18 4.75V20.5L12 16.75L6 20.5V4.75Z"
        stroke="#0f3b2e"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const menuItems: MenuItem[] = [
  {
    label: "Gespeicherte Spots",
    href: "/saved",
    icon: <SavedSpotsIcon />,
  },
];

type Props = {
  onOpenChange?: (open: boolean) => void;
};

export default function TopRightMenu({ onOpenChange }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    if (!open) return;

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function handleNavigate(href: string) {
    setOpen(false);
    if (pathname !== href) router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center text-white transition hover:scale-110"
        aria-label="Menü öffnen"
        title="Menü"
      >
        <MenuIcon />
      </button>

      <div
        className={`fixed inset-0 z-50 transition ${open ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-black/20 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
          aria-label="Menü schließen"
        />

        <aside
          className={`absolute right-0 top-0 h-full w-[280px] max-w-[82vw] bg-[#e8decc] shadow-2xl transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-[#ece6da] px-5 py-4">
            <div className="text-[15px] font-bold text-[#0f3b2e]">Menü</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[26px] leading-none text-[#0f3b2e] transition hover:opacity-70"
              aria-label="Menü schließen"
            >
              ×
            </button>
          </div>

          <nav className="px-3 py-3">
            {menuItems.map((item) => (
              <button
                key={item.href}
                type="button"
                onClick={() => handleNavigate(item.href)}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[#0f3b2e] transition hover:bg-[#f6efe3]"
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="text-[15px] font-semibold">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>
      </div>
    </>
  );
}
