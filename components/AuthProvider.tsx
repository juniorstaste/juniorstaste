"use client";

import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { supabase } from "@/lib/supabaseClient";
import { logSupabaseError } from "@/lib/logSupabaseError";
import { safeGetItem, safeRemoveItem, safeSetItem } from "@/lib/safeStorage";

type Profile = {
  id: string;
  email: string | null;
  display_name: string;
};

type PostAuthAction =
  | { type: "open-saved"; returnTo?: string }
  | { type: "save-spot"; spotId: string; returnTo?: string };

type AuthContextValue = {
  authLoading: boolean;
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  savedSpotIds: string[];
  savedSpotIdsSet: Set<string>;
  authPromptOpen: boolean;
  openAuthPrompt: (action?: PostAuthAction) => void;
  closeAuthPrompt: () => void;
  signOut: () => Promise<void>;
  isSavedSpot: (spotId: string) => boolean;
  toggleSavedSpot: (spotId: string) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const POST_AUTH_KEY = "post_auth_action";
const SAVED_SPOT_IDS_KEY = "saved_spot_ids";
// Nach Ablauf wird eine gespeicherte post_auth_action verworfen, damit ein
// späterer, unabhängiger Login keine veraltete Aktion mehr ausführt.
const POST_AUTH_MAX_AGE_MS = 60 * 60 * 1000;

type StoredPostAuthAction = {
  ts: number;
  action: PostAuthAction;
};

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function getDisplayName(user: User) {
  const fromMetadata =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name
      : typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : null;

  if (fromMetadata && fromMetadata.trim()) return fromMetadata.trim();
  if (user.email) return user.email.split("@")[0];
  return "JuniorsTaste User";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const mountedRef = useRef(true);
  // ID des aktuell eingeloggten Users — damit in-flight Fetches nach einem
  // Logout/Userwechsel ihr Ergebnis verwerfen statt veralteten State zu setzen.
  const activeUserIdRef = useRef<string | null>(null);
  // Verhindert doppelten Voll-Sync pro User (INITIAL_SESSION + SIGNED_IN
  // feuern sonst beide pro Pageload) sowie Re-Sync bei TOKEN_REFRESHED.
  const lastSyncedUserIdRef = useRef<string | null>(null);
  const postAuthInFlightRef = useRef(false);
  const togglingSpotIdsRef = useRef<Set<string>>(new Set());

  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [savedSpotIds, setSavedSpotIds] = useState<string[]>([]);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);

  const savedSpotIdsSet = useMemo(() => new Set(savedSpotIds), [savedSpotIds]);

  const loadSavedSpotIds = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("saved_spots")
      .select("spot_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    // Ergebnis verwerfen, wenn der User inzwischen ausgeloggt oder gewechselt ist
    if (!mountedRef.current || activeUserIdRef.current !== userId) return;

    if (error) {
      logSupabaseError("Konnte gespeicherte Spots nicht laden:", error);
      setSavedSpotIds([]);
      return;
    }

    setSavedSpotIds((data ?? []).map((row: { spot_id: string }) => row.spot_id));
  }, []);

  const migrateLocalSavedSpots = useCallback(async (userId: string) => {
    if (typeof window === "undefined") return;

    const raw = safeGetItem(SAVED_SPOT_IDS_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      const spotIds = Array.isArray(parsed)
        ? Array.from(
            new Set(
              parsed
                .filter((value): value is string => typeof value === "string")
                .map((value) => value.trim())
                .filter((value) => value.length > 0 && isUuidLike(value))
            )
          )
        : [];

      if (spotIds.length === 0) {
        safeRemoveItem(SAVED_SPOT_IDS_KEY);
        return;
      }

      const { data: existingSpots, error: existingSpotsError } = await supabase
        .from("spots")
        .select("id")
        .in("id", spotIds);

      if (existingSpotsError) {
        // Key behalten: transienter Fehler — Migration wird beim nächsten
        // Auth-Event erneut versucht, statt die lokale Merkliste zu verlieren.
        logSupabaseError(
          "Konnte gueltige Spots fuer lokale Migration nicht pruefen:",
          existingSpotsError
        );
        return;
      }

      const validSpotIds = new Set(
        (existingSpots ?? []).map((spot: { id: string }) => spot.id)
      );

      const migratableSpotIds = spotIds.filter((spotId) => validSpotIds.has(spotId));

      if (migratableSpotIds.length === 0) {
        safeRemoveItem(SAVED_SPOT_IDS_KEY);
        return;
      }

      const { error } = await supabase.from("saved_spots").upsert(
        migratableSpotIds.map((spotId) => ({
          user_id: userId,
          spot_id: spotId,
        })),
        {
          onConflict: "user_id,spot_id",
        }
      );

      if (error) {
        // Key behalten: Upsert kann beim nächsten Auth-Event erneut versucht werden
        logSupabaseError("Konnte lokale gespeicherte Spots nicht migrieren:", error);
        return;
      }

      safeRemoveItem(SAVED_SPOT_IDS_KEY);
    } catch (error) {
      console.error("Konnte lokale gespeicherte Spots nicht migrieren:", {
        error,
        message: error instanceof Error ? error.message : undefined,
        json: (() => {
          try {
            return JSON.stringify(error, null, 2);
          } catch {
            return undefined;
          }
        })(),
      });
      safeRemoveItem(SAVED_SPOT_IDS_KEY);
    }
  }, []);

  const ensureProfile = useCallback(async (nextUser: User) => {
    const payload = {
      id: nextUser.id,
      email: nextUser.email ?? null,
      display_name: getDisplayName(nextUser),
    };

    const { data, error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select("id, email, display_name")
      .single();

    const canApply = () =>
      mountedRef.current && activeUserIdRef.current === nextUser.id;

    if (error) {
      if (canApply()) setProfile(payload);
      return payload;
    }

    const nextProfile = data as Profile;
    if (canApply()) setProfile(nextProfile);
    return nextProfile;
  }, []);

  const resolveActiveUser = useCallback(async () => {
    if (user) return user;

    const {
      data: { user: nextUser },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      logSupabaseError("Konnte aktuellen Supabase-User nicht laden:", userError);
    }

    if (nextUser) {
      activeUserIdRef.current = nextUser.id;

      if (mountedRef.current) {
        setUser(nextUser);
        setAuthLoading(false);
      }

      return nextUser;
    }

    const {
      data: { session: nextSession },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      logSupabaseError("Konnte Supabase-Session nicht laden:", sessionError);
      return null;
    }

    if (!nextSession?.user) return null;

    activeUserIdRef.current = nextSession.user.id;

    if (mountedRef.current) {
      setSession(nextSession);
      setUser(nextSession.user);
      setAuthLoading(false);
    }

    return nextSession.user;
  }, [user]);

  const handlePostAuthAction = useCallback(
    async (nextUser: User) => {
      if (typeof window === "undefined") return;
      if (postAuthInFlightRef.current) return;

      const raw = safeGetItem(POST_AUTH_KEY);
      if (!raw) return;

      postAuthInFlightRef.current = true;

      try {
        let action: PostAuthAction;

        try {
          const stored = JSON.parse(raw) as Partial<StoredPostAuthAction>;

          // Altformatige (ohne Timestamp) oder abgelaufene Actions verwerfen,
          // damit ein späterer, unabhängiger Login sie nicht mehr ausführt.
          if (
            !stored ||
            typeof stored.ts !== "number" ||
            !stored.action ||
            Date.now() - stored.ts > POST_AUTH_MAX_AGE_MS
          ) {
            safeRemoveItem(POST_AUTH_KEY);
            return;
          }

          action = stored.action;
        } catch {
          safeRemoveItem(POST_AUTH_KEY);
          return;
        }

        if (action.type === "open-saved") {
          safeRemoveItem(POST_AUTH_KEY);
          router.push(action.returnTo ?? "/saved");
          return;
        }

        if (action.type === "save-spot") {
          const { error } = await supabase.from("saved_spots").insert({
            user_id: nextUser.id,
            spot_id: action.spotId,
          });

          if (error && error.code !== "23505") {
            // Key behalten: transienter Fehler — der nächste Sync versucht
            // die Action erneut, statt den Speicherwunsch zu verlieren.
            logSupabaseError("Konnte gespeicherten Spot nach Login nicht anlegen:", error);
            return;
          }

          safeRemoveItem(POST_AUTH_KEY);
          await loadSavedSpotIds(nextUser.id);

          if (action.returnTo) {
            router.push(action.returnTo);
          }
        }
      } finally {
        postAuthInFlightRef.current = false;
      }
    },
    [loadSavedSpotIds, router]
  );

  const syncUserState = useCallback(
    async (nextUser: User) => {
      await ensureProfile(nextUser);
      await migrateLocalSavedSpots(nextUser.id);
      await loadSavedSpotIds(nextUser.id);
      await handlePostAuthAction(nextUser);
    },
    [ensureProfile, handlePostAuthAction, loadSavedSpotIds, migrateLocalSavedSpots]
  );

  useEffect(() => {
    mountedRef.current = true;

    // Kein separates bootstrap(): supabase-js feuert INITIAL_SESSION an alle
    // Subscriber — ein zweiter manueller Sync würde Profil-Upsert, Migration
    // und saved_spots-Fetch pro Pageload doppelt ausführen.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      activeUserIdRef.current = nextSession?.user?.id ?? null;

      if (!nextSession?.user) {
        lastSyncedUserIdRef.current = null;
        setProfile(null);
        setSavedSpotIds([]);
        setAuthPromptOpen(false);
        setAuthLoading(false);
        return;
      }

      // Token-Refresh (~stündlich) ändert nur die Session — kein erneuter
      // Profil-Upsert/Merklisten-Sync nötig.
      if (event === "TOKEN_REFRESHED") {
        setAuthLoading(false);
        return;
      }

      // Voll-Sync pro User nur einmal (INITIAL_SESSION und SIGNED_IN können
      // beide pro Pageload eintreffen); USER_UPDATED synchronisiert erneut.
      if (
        event !== "USER_UPDATED" &&
        lastSyncedUserIdRef.current === nextSession.user.id
      ) {
        setAuthLoading(false);
        return;
      }

      lastSyncedUserIdRef.current = nextSession.user.id;

      void syncUserState(nextSession.user).finally(() => {
        if (mountedRef.current) {
          setAuthPromptOpen(false);
          setAuthLoading(false);
        }
      });
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [syncUserState]);

  const openAuthPrompt = useCallback((action?: PostAuthAction) => {
    if (typeof window !== "undefined" && action) {
      const stored: StoredPostAuthAction = { ts: Date.now(), action };
      safeSetItem(POST_AUTH_KEY, JSON.stringify(stored));
    }

    setAuthPromptOpen(true);
  }, []);

  const closeAuthPrompt = useCallback(() => {
    setAuthPromptOpen(false);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setAuthPromptOpen(false);
    if (pathname === "/saved") router.push("/");
  }, [pathname, router]);

  const isSavedSpot = useCallback(
    (spotId: string) => {
      return savedSpotIdsSet.has(spotId);
    },
    [savedSpotIdsSet]
  );

  const toggleSavedSpot = useCallback(
    async (spotId: string) => {
      // In-Flight-Guard: Ein schneller zweiter Klick würde sonst den noch
      // alten Zustand lesen und z.B. doppelt inserten statt zu entfernen.
      if (togglingSpotIdsRef.current.has(spotId)) {
        return savedSpotIdsSet.has(spotId);
      }

      togglingSpotIdsRef.current.add(spotId);

      try {
        if (!user) {
          const activeUser = await resolveActiveUser();

          if (!activeUser) {
            openAuthPrompt({ type: "save-spot", spotId, returnTo: pathname });
            return false;
          }

          if (mountedRef.current) {
            setUser(activeUser);
          }

          await ensureProfile(activeUser);
        }

        const activeUser = user ?? (await resolveActiveUser());

        if (!activeUser) {
          openAuthPrompt({ type: "save-spot", spotId, returnTo: pathname });
          return false;
        }

        const currentlySaved = savedSpotIdsSet.has(spotId);

        if (currentlySaved) {
          const { error } = await supabase
            .from("saved_spots")
            .delete()
            .eq("user_id", activeUser.id)
            .eq("spot_id", spotId);

          if (error) {
            logSupabaseError("Konnte gespeicherten Spot nicht entfernen:", error);
            return false;
          }

          await loadSavedSpotIds(activeUser.id);

          return true;
        }

        const { error } = await supabase.from("saved_spots").insert({
          user_id: activeUser.id,
          spot_id: spotId,
        });

        if (error && error.code !== "23505") {
          logSupabaseError("Konnte gespeicherten Spot nicht anlegen:", error);
          return false;
        }

        await loadSavedSpotIds(activeUser.id);

        return true;
      } finally {
        togglingSpotIdsRef.current.delete(spotId);
      }
    },
    [ensureProfile, loadSavedSpotIds, openAuthPrompt, pathname, resolveActiveUser, savedSpotIdsSet, user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      authLoading,
      user,
      session,
      profile,
      savedSpotIds,
      savedSpotIdsSet,
      authPromptOpen,
      openAuthPrompt,
      closeAuthPrompt,
      signOut,
      isSavedSpot,
      toggleSavedSpot,
    }),
    [
      authLoading,
      user,
      session,
      profile,
      savedSpotIds,
      savedSpotIdsSet,
      authPromptOpen,
      openAuthPrompt,
      closeAuthPrompt,
      signOut,
      isSavedSpot,
      toggleSavedSpot,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}

      {!user && authPromptOpen ? (
        <div className="fixed inset-0 z-[70]">
          <button
            type="button"
            onClick={closeAuthPrompt}
            className="absolute inset-0 bg-black/35"
            aria-label="Login schließen"
          />

          <div className="absolute inset-x-4 top-1/2 mx-auto w-full max-w-[380px] -translate-y-1/2 rounded-[28px] border border-[#ece6da] bg-[#e8decc] p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-extrabold text-[#0f3b2e]">
                  Willkommen bei JuniorsTaste
                </div>
                <p className="mt-1 text-sm text-[#0f3b2e]/80">
                  Erstelle ein Konto oder logge dich mit E-Mail und Passwort ein.
                </p>
              </div>

              <button
                type="button"
                onClick={closeAuthPrompt}
                className="text-[28px] leading-none text-[#0f3b2e]"
                aria-label="Login schließen"
              >
                ×
              </button>
            </div>

            <AuthForm mode="modal" initialView="signup" />
          </div>
        </div>
      ) : null}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
