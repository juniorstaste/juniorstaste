"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import AuthForm from "@/components/AuthForm";
import { useAuth } from "@/components/AuthProvider";
import { usePathname, useRouter } from "next/navigation";

type MenuItem = {
  label: string;
  href: string;
  icon: ReactNode;
  disabled?: boolean;
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

function CitySwitchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20.5s6-4.85 6-10a6 6 0 1 0-12 0c0 5.15 6 10 6 10Z"
        stroke="#0f3b2e"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
        stroke="#0f3b2e"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NotificationsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.5 16.5h11l-1.2-1.4a2.5 2.5 0 0 1-.6-1.62V10a3.7 3.7 0 1 0-7.4 0v3.48a2.5 2.5 0 0 1-.6 1.62L6.5 16.5Z"
        stroke="#0f3b2e"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 18.5a2 2 0 0 0 4 0"
        stroke="#0f3b2e"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 15.1a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2Z"
        stroke="#0f3b2e"
        strokeWidth="1.8"
      />
      <path
        d="M19 12a7.2 7.2 0 0 0-.08-1l2-1.55-2-3.45-2.38.72a7.62 7.62 0 0 0-1.72-1L14.5 3h-5l-.32 2.72a7.62 7.62 0 0 0-1.72 1L5.08 6 3 9.45 5 11a7.2 7.2 0 0 0 0 2l-2 1.55L5.08 18l2.38-.72a7.62 7.62 0 0 0 1.72 1L9.5 21h5l.32-2.72a7.62 7.62 0 0 0 1.72-1l2.38.72L21 14.55 19 13a7.2 7.2 0 0 0 .08-1Z"
        stroke="#0f3b2e"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
        stroke="#0f3b2e"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 20a8 8 0 0 1 16 0"
        stroke="#0f3b2e"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LegalIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 4.5h8.5L19 8v11.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1Z"
        stroke="#0f3b2e"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 4.5V8h3.5"
        stroke="#0f3b2e"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 12h6" stroke="#0f3b2e" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 16h6" stroke="#0f3b2e" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const menuItems: MenuItem[] = [
  {
    label: "Gespeicherte Spots",
    href: "/saved",
    icon: <SavedSpotsIcon />,
  },
  {
    label: "Stadt wechseln",
    href: "/#cities",
    icon: <CitySwitchIcon />,
  },
  {
    label: "Benachrichtigungen",
    href: "#",
    icon: <NotificationsIcon />,
    disabled: true,
  },
  {
    label: "Einstellungen",
    href: "#",
    icon: <SettingsIcon />,
    disabled: true,
  },
];

const legalItems: MenuItem[] = [
  {
    label: "Impressum",
    href: "/impressum",
    icon: <LegalIcon />,
  },
  {
    label: "Datenschutz",
    href: "/datenschutz",
    icon: <LegalIcon />,
  },
];

type Props = {
  onOpenChange?: (open: boolean) => void;
};

export default function TopRightMenu({ onOpenChange }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { authLoading, user, profile, signOut, openAuthPrompt } = useAuth();
  const [open, setOpen] = useState(false);
  const [authHint, setAuthHint] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

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
    if (href === "/#cities") {
      if (pathname === "/") {
        window.history.replaceState(null, "", "/#cities");
        document.getElementById("cities")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        return;
      }
      router.push(href);
      return;
    }
    if (pathname !== href) router.push(href);
  }

  function handleSavedSpotsClick() {
    if (!user) {
      setAuthHint("Bitte melde dich an, um deine gespeicherten Spots zu sehen.");
      openAuthPrompt({ type: "open-saved", returnTo: "/saved" });
      return;
    }

    handleNavigate("/saved");
  }

  const displayName =
    profile?.display_name?.trim() || (user?.email ? user.email.split("@")[0] : "Account");

  const menuLayer = (
    <div
      className={`fixed inset-0 z-[2000] transition ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
      // Geschlossen ist der Drawer nur offscreen — ohne inert blieben seine
      // Buttons (inkl. Logout) per Tab+Enter unsichtbar auslösbar.
      inert={!open}
    >
      <button
        type="button"
        onClick={() => setOpen(false)}
        className={`absolute inset-0 bg-black/20 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        aria-label="Menü schließen"
      />

      <aside
        className={`absolute right-0 top-0 flex h-full w-[280px] max-w-[82vw] flex-col bg-[#e8decc] shadow-2xl transition-transform duration-300 ease-out ${
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

        <div className="border-b border-[#ece6da] px-4 py-4">
          <div className="rounded-2xl bg-[#fffaf2] p-4 shadow-sm">
            <div className="mb-3 flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                <AccountIcon />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold text-[#0f3b2e]">Account</div>

                {authLoading ? (
                  <p className="mt-1 text-sm text-[#0f3b2e]/70">Account wird geladen…</p>
                ) : user ? (
                  <>
                    <p className="mt-1 truncate text-sm font-semibold text-[#0f3b2e]">
                      {displayName}
                    </p>
                    <p className="truncate text-sm text-[#0f3b2e]/75">{user.email}</p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-[#0f3b2e]/75">
                    Logge dich mit E-Mail und Passwort ein oder erstelle ein neues Konto.
                  </p>
                )}
              </div>
            </div>

            {user ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  void signOut();
                }}
                className="w-full rounded-2xl border border-[#d8ccb7] bg-[#e8decc] px-4 py-3 text-[15px] font-semibold text-[#0f3b2e] transition hover:bg-[#ded3be]"
              >
                Logout
              </button>
            ) : (
              <AuthForm mode="drawer" initialView="login" />
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <nav className="px-3 py-3">
            <button
              type="button"
              onClick={handleSavedSpotsClick}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[#0f3b2e] transition hover:bg-[#f6efe3]"
            >
              <span className="shrink-0">{menuItems[0].icon}</span>
              <span className="text-[15px] font-semibold">{menuItems[0].label}</span>
            </button>

            {menuItems.slice(1).map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return;
                  handleNavigate(item.href);
                }}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[#0f3b2e] transition ${
                  item.disabled
                    ? "cursor-default opacity-55"
                    : "hover:bg-[#f6efe3]"
                }`}
                title={item.disabled ? "Bald verfügbar" : undefined}
                aria-disabled={item.disabled ? "true" : undefined}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="text-[15px] font-semibold">{item.label}</span>
              </button>
            ))}

            {!user && authHint ? (
              <p className="px-3 pt-2 text-sm text-[#7b3a2a]">{authHint}</p>
            ) : null}
          </nav>

          <nav className="mt-auto border-t border-[#d8ccb7] px-3 py-3">
            {legalItems.map((item) => (
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
        </div>
      </aside>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAuthHint(null);
          setOpen(true);
        }}
        className="inline-flex items-center justify-center text-white transition hover:scale-110"
        aria-label="Menü öffnen"
        title="Menü"
      >
        <MenuIcon />
      </button>

      {mounted ? createPortal(menuLayer, document.body) : null}
    </>
  );
}
