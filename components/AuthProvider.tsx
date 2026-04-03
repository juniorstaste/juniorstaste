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

    if (error) {
      logSupabaseError("Konnte gespeicherte Spots nicht laden:", error);
      if (mountedRef.current) setSavedSpotIds([]);
      return;
    }

    if (mountedRef.current) {
      setSavedSpotIds((data ?? []).map((row: { spot_id: string }) => row.spot_id));
    }
  }, []);

  const migrateLocalSavedSpots = useCallback(async (userId: string) => {
    if (typeof window === "undefined") return;

    const raw = window.localStorage.getItem("saved_spot_ids");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      const spotIds = Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === "string")
        : [];

      if (spotIds.length === 0) {
        window.localStorage.removeItem("saved_spot_ids");
        return;
      }

      const { data: existingSpots, error: existingSpotsError } = await supabase
        .from("spots")
        .select("id")
        .in("id", spotIds);

      if (existingSpotsError) {
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
        window.localStorage.removeItem("saved_spot_ids");
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
        logSupabaseError("Konnte lokale gespeicherte Spots nicht migrieren:", error);
        return;
      }

      window.localStorage.removeItem("saved_spot_ids");
    } catch {
      window.localStorage.removeItem("saved_spot_ids");
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

    if (error) {
      if (mountedRef.current) setProfile(payload);
      return payload;
    }

    const nextProfile = data as Profile;
    if (mountedRef.current) setProfile(nextProfile);
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

      const raw = window.localStorage.getItem(POST_AUTH_KEY);
      if (!raw) return;

      window.localStorage.removeItem(POST_AUTH_KEY);

      try {
        const action = JSON.parse(raw) as PostAuthAction;

        if (action.type === "open-saved") {
          router.push(action.returnTo ?? "/saved");
          return;
        }

        if (action.type === "save-spot") {
          const { error } = await supabase.from("saved_spots").insert({
            user_id: nextUser.id,
            spot_id: action.spotId,
          });

          if (error && error.code !== "23505") {
            logSupabaseError("Konnte gespeicherten Spot nach Login nicht anlegen:", error);
            return;
          }

          await loadSavedSpotIds(nextUser.id);

          if (action.returnTo) {
            router.push(action.returnTo);
          }
        }
      } catch {
        window.localStorage.removeItem(POST_AUTH_KEY);
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

    async function bootstrap() {
      const {
        data: { session: nextSession },
      } = await supabase.auth.getSession();

      if (!mountedRef.current) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        await syncUserState(nextSession.user);
        if (mountedRef.current) setAuthPromptOpen(false);
      } else {
        setProfile(null);
        setSavedSpotIds([]);
      }

      if (mountedRef.current) setAuthLoading(false);
    }

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setProfile(null);
        setSavedSpotIds([]);
        setAuthPromptOpen(false);
        setAuthLoading(false);
        return;
      }

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
      window.localStorage.setItem(POST_AUTH_KEY, JSON.stringify(action));
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
      console.log("SaveSpotButton geklickt:", spotId);

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

      console.log("Aktiver User fuer SaveSpot:", activeUser.id);

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
