"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { User } from "@supabase/supabase-js";
import { Heart } from "@phosphor-icons/react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";
import { logSupabaseError } from "@/lib/logSupabaseError";

type ProfileLike = {
  display_name?: string | null;
} | null;

type Comment = {
  id: string;
  username: string;
  content: string;
  parent_id: string | null;
  created_at: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  spotId: string | null;
  spotName?: string | null;
  spotImageUrl?: string | null;
  user: User | null;
  profile: ProfileLike;
  onRequireAuth: () => void;
  variant?: "classic" | "for-you";
};

function getCommentUsername(user: User | null, profile: ProfileLike) {
  const candidates = [
    profile?.display_name,
    typeof user?.user_metadata?.username === "string" ? user.user_metadata.username : null,
    typeof user?.user_metadata?.display_name === "string" ? user.user_metadata.display_name : null,
    typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null,
    typeof user?.user_metadata?.name === "string" ? user.user_metadata.name : null,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "User";
}

function formatCommentTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) return `vor ${diffMinutes} Min.`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `vor ${diffHours} Std.`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `vor ${diffDays} Tagen`;

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(timestamp));
}

export default function SpotCommentsSheet({
  open,
  onClose,
  spotId,
  spotName,
  spotImageUrl,
  user,
  profile,
  onRequireAuth,
  variant = "classic",
}: Props) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<{ id: string; username: string } | null>(null);
  const [commentLikeCounts, setCommentLikeCounts] = useState<Record<string, number>>({});
  const [likedCommentIds, setLikedCommentIds] = useState<Record<string, boolean>>({});
  const [likePendingId, setLikePendingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragStartYRef = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const currentUsername = useMemo(() => getCommentUsername(user, profile), [profile, user]);
  const trimmedContent = content.trim();
  const isForYou = variant === "for-you";
  const normalizedSpotImageUrl =
    typeof spotImageUrl === "string" && spotImageUrl.trim().length > 0
      ? spotImageUrl.trim()
      : null;

  useEffect(() => {
    if (!open) {
      setDragOffset(0);
      setIsDragging(false);
      dragPointerIdRef.current = null;
      setCommentLikeCounts({});
      setLikedCommentIds({});
      setLikePendingId(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !spotId) return;

    let cancelled = false;

    async function loadComments() {
      setLoading(true);
      setErrorMsg(null);

      const { data, error } = await supabase
        .from("spot_comments")
        .select("id, username, content, parent_id, created_at")
        .eq("spot_id", spotId)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (error) {
        logSupabaseError("Konnte Kommentare nicht laden:", {
          error,
          spotId,
          userId: user?.id ?? null,
          variant,
        });
        setComments([]);
        setErrorMsg("Kommentare konnten gerade nicht geladen werden.");
        setLoading(false);
        return;
      }

      const nextComments = ((data as Comment[] | null) ?? []).filter((comment) => comment.content?.trim());
      setComments(nextComments);

      const commentIds = nextComments.map((comment) => comment.id);
      if (commentIds.length > 0) {
        const { data: likesData, error: likesError } = await supabase
          .from("comment_likes")
          .select("comment_id, user_id")
          .in("comment_id", commentIds);

        if (likesError) {
          logSupabaseError("Konnte Kommentar-Likes nicht laden:", {
            error: likesError,
            spotId,
            userId: user?.id ?? null,
            commentIds,
          });
          setCommentLikeCounts({});
          setLikedCommentIds({});
        } else {
          const nextCounts: Record<string, number> = {};
          const nextLiked: Record<string, boolean> = {};

          for (const like of
            (likesData as Array<{ comment_id: string; user_id: string | null }> | null) ?? []) {
            nextCounts[like.comment_id] = (nextCounts[like.comment_id] ?? 0) + 1;
            if (user?.id && like.user_id === user.id) {
              nextLiked[like.comment_id] = true;
            }
          }

          setCommentLikeCounts(nextCounts);
          setLikedCommentIds(nextLiked);
        }
      } else {
        setCommentLikeCounts({});
        setLikedCommentIds({});
      }

      setLoading(false);
    }

    void loadComments();

    return () => {
      cancelled = true;
    };
  }, [open, spotId, user?.id, variant]);

  async function submitComment() {
    if (!spotId) return;

    if (!trimmedContent) {
      setErrorMsg("Bitte schreibe zuerst einen Kommentar.");
      return;
    }

    if (!user) {
      onRequireAuth();
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const payload = {
      spot_id: spotId,
      user_id: user.id,
      username: currentUsername,
      content: trimmedContent,
      parent_id: replyTarget?.id ?? null,
    };

    const { data, error } = await supabase
      .from("spot_comments")
      .insert(payload as {
        spot_id: string;
        user_id: string;
        username: string;
        content: string;
        parent_id: string | null;
      })
      .select("id, username, content, parent_id, created_at")
      .single();

    setSubmitting(false);

    if (error) {
      logSupabaseError("Konnte Kommentar nicht speichern:", {
        error,
        spotId,
        userId: user.id,
        username: currentUsername,
        hasReplyTarget: replyTarget !== null,
      });
      setErrorMsg("Kommentar konnte nicht gespeichert werden.");
      return;
    }

    setComments((current) => [...current, data as Comment]);
    setContent("");
    setReplyTarget(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitComment();
  }

  async function toggleCommentLike(commentId: string) {
    if (!user) {
      onRequireAuth();
      return;
    }

    if (likePendingId) return;

    const wasLiked = likedCommentIds[commentId] === true;
    setLikePendingId(commentId);
    setLikedCommentIds((current) => ({ ...current, [commentId]: !wasLiked }));
    setCommentLikeCounts((current) => ({
      ...current,
      [commentId]: Math.max(0, (current[commentId] ?? 0) + (wasLiked ? -1 : 1)),
    }));

    if (wasLiked) {
      const { error } = await supabase
        .from("comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", user.id);

      setLikePendingId(null);

      if (error) {
        logSupabaseError("Konnte Kommentar-Like nicht entfernen:", {
          error,
          commentId,
          userId: user.id,
        });
        setLikedCommentIds((current) => ({ ...current, [commentId]: true }));
        setCommentLikeCounts((current) => ({
          ...current,
          [commentId]: (current[commentId] ?? 0) + 1,
        }));
      }

      return;
    }

    const { error } = await supabase.from("comment_likes").insert({
      comment_id: commentId,
      user_id: user.id,
    });

    setLikePendingId(null);

    if (error) {
      logSupabaseError("Konnte Kommentar-Like nicht speichern:", {
        error,
        commentId,
        userId: user.id,
      });
      setLikedCommentIds((current) => ({ ...current, [commentId]: false }));
      setCommentLikeCounts((current) => ({
        ...current,
        [commentId]: Math.max(0, (current[commentId] ?? 0) - 1),
      }));
    }
  }

  function handleSheetDragStart(event: React.PointerEvent<HTMLDivElement>) {
    if (!isForYou) return;

    dragPointerIdRef.current = event.pointerId;
    dragStartYRef.current = event.clientY;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleSheetDragMove(event: React.PointerEvent<HTMLElement>) {
    if (!isForYou || dragPointerIdRef.current !== event.pointerId) return;

    const nextOffset = Math.max(0, event.clientY - dragStartYRef.current);
    setDragOffset(nextOffset);
  }

  function finishSheetDrag(pointerId: number) {
    if (!isForYou || dragPointerIdRef.current !== pointerId) return;

    dragPointerIdRef.current = null;
    setIsDragging(false);

    if (dragOffset > 120) {
      setDragOffset(0);
      onClose();
      return;
    }

    setDragOffset(0);
  }

  if (!mounted || !open || !spotId) return null;

  return createPortal(
    <div className="fixed inset-0 z-[4200]">
      <button
        type="button"
        onClick={onClose}
        className={`absolute inset-0 ${isForYou ? "bg-black/20" : "bg-black/50"}`}
        aria-label="Kommentare schließen"
      />

      <section
        onPointerMove={handleSheetDragMove}
        onPointerUp={(event) => finishSheetDrag(event.pointerId)}
        onPointerCancel={(event) => finishSheetDrag(event.pointerId)}
        className={`absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-[560px] flex-col overflow-hidden rounded-t-[30px] border shadow-2xl ${
          isForYou
            ? "h-[50dvh] border-white/10 bg-[#1f1f1f]/92 text-white backdrop-blur-xl"
            : "h-[50dvh] border-white/10 bg-[#e8decc] text-[#0f3b2e]"
        }`}
        style={{
          transform: `translateY(${dragOffset}px)`,
          transition: isDragging ? "none" : "transform 220ms ease-out",
        }}
      >
        <div
          onPointerDown={handleSheetDragStart}
          className={`px-5 pb-4 pt-3 ${isForYou ? "border-b border-white/10 touch-none" : ""}`}
        >
          <div
            className={`mx-auto mb-3 h-1.5 w-12 rounded-full ${
              isForYou ? "bg-white/90" : "bg-[#0f3b2e]/15"
            }`}
          />

          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 pr-12">
              {normalizedSpotImageUrl ? (
                <img
                  src={normalizedSpotImageUrl}
                  alt={spotName ?? "Spot"}
                  className="mt-[-2px] h-12 w-12 rounded-xl object-cover"
                />
              ) : (
                <div
                  className={`mt-[-2px] flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold ${
                    isForYou ? "bg-white/12 text-white/70" : "bg-[#0f3b2e]/10 text-[#0f3b2e]/55"
                  }`}
                  aria-hidden="true"
                >
                  {(spotName?.trim().charAt(0) || "S").toUpperCase()}
                </div>
              )}
            </div>

            <h2
              className={`pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 text-center text-lg font-extrabold ${
                isForYou ? "text-white" : "text-[#0f3b2e]"
              }`}
            >
              Kommentare
            </h2>

            <button
              type="button"
              onClick={onClose}
              className={`ml-auto text-[28px] leading-none ${isForYou ? "text-white" : "text-[#0f3b2e]"}`}
              aria-label="Kommentare schließen"
            >
              ×
            </button>
          </div>
        </div>

        <div className={`no-scrollbar flex-1 overflow-y-auto px-5 ${isForYou ? "pb-28 pt-3" : "pb-4"}`}>
          {loading ? (
            <p className={`text-sm ${isForYou ? "text-white/60" : "text-[#0f3b2e]/65"}`}>Kommentare werden geladen…</p>
          ) : comments.length === 0 ? (
            <div
              className={`flex items-center justify-center text-center ${
                isForYou ? "min-h-[calc(100%-5rem)] pt-6" : "min-h-full py-10"
              }`}
            >
              <p className={`text-sm font-medium ${isForYou ? "text-white/68" : "text-[#0f3b2e]/65"}`}>Beginne die Konversation</p>
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <article
                  key={comment.id}
                  className={`rounded-2xl p-3 ${isForYou ? "bg-transparent" : "bg-[#fffaf2] shadow-sm"}`}
                >
                  <svg width="0" height="0" className="absolute">
                    <defs>
                      <linearGradient id={`comment-like-gradient-${comment.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="rgb(255, 124, 144)" />
                        <stop offset="100%" stopColor="rgb(255, 225, 164)" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="flex items-center justify-between gap-3">
                    <div className={`truncate text-sm font-bold ${isForYou ? "text-white" : "text-[#0f3b2e]"}`}>
                      {comment.username}
                    </div>
                    <div className={`shrink-0 text-xs ${isForYou ? "text-white/42" : "text-[#0f3b2e]/55"}`}>
                      {formatCommentTime(comment.created_at)}
                    </div>
                  </div>
                  <p className={`mt-1.5 whitespace-pre-wrap text-sm leading-relaxed ${isForYou ? "text-white/88" : "text-[#0f3b2e]/82"}`}>
                    {comment.content}
                  </p>
                  <div className={`mt-2 flex items-center justify-between gap-3 text-xs font-medium ${isForYou ? "text-white/45" : "text-[#0f3b2e]/55"}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTarget({ id: comment.id, username: comment.username });
                        inputRef.current?.focus();
                      }}
                      className="transition hover:opacity-80"
                    >
                      Antworten
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleCommentLike(comment.id)}
                      disabled={likePendingId === comment.id}
                      className={`inline-flex items-center gap-1 text-xs font-medium transition hover:opacity-80 ${
                        isForYou ? "text-white/70" : "text-[#0f3b2e]/65"
                      }`}
                      aria-label={likedCommentIds[comment.id] ? "Kommentar-Like entfernen" : "Kommentar liken"}
                    >
                      <Heart
                        size={18}
                        weight={likedCommentIds[comment.id] ? "fill" : "regular"}
                        aria-hidden="true"
                        className={likedCommentIds[comment.id] ? "" : isForYou ? "text-white/80" : "text-[#0f3b2e]/65"}
                        style={
                          likedCommentIds[comment.id]
                            ? { fill: `url(#comment-like-gradient-${comment.id})` }
                            : undefined
                        }
                      />
                      {(commentLikeCounts[comment.id] ?? 0) > 0 ? (
                        <span>{commentLikeCounts[comment.id]}</span>
                      ) : null}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div
          className={`mt-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 ${
            isForYou
              ? "border-t border-white/10 bg-[#1f1f1f]/98"
              : "border-t border-[#d8ccb7] bg-[#efe5d6]"
          }`}
        >
          {user ? (
            <form onSubmit={handleSubmit} className="space-y-2">
              {replyTarget ? (
                <div className={`flex items-center justify-between gap-3 text-xs ${isForYou ? "text-white/50" : "text-[#0f3b2e]/55"}`}>
                  <span>Antwort an @{replyTarget.username}</span>
                  <button
                    type="button"
                    onClick={() => setReplyTarget(null)}
                    className="transition hover:opacity-80"
                  >
                    Abbrechen
                  </button>
                </div>
              ) : null}
              <div className="relative">
                <input
                  ref={inputRef}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  maxLength={500}
                  placeholder={
                    replyTarget
                      ? `Antwort an @${replyTarget.username} …`
                      : "Kommentar hinzufügen …"
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      if (!trimmedContent || submitting) return;
                      void submitComment();
                    }
                  }}
                  className={`h-14 w-full rounded-full border px-4 pr-14 text-sm focus:outline-none ${
                    isForYou
                      ? "border-white/10 bg-white/10 text-white placeholder:text-white/38"
                      : "border-[#d8ccb7] bg-[#fffaf2] text-[#0f2a22] placeholder:text-[#0f2a22]/45"
                  }`}
                />
                <button
                  type="submit"
                  disabled={submitting || !trimmedContent}
                  className={`absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full transition ${
                    trimmedContent && !submitting
                      ? isForYou
                        ? "bg-white text-[#1f1f1f]"
                        : "bg-[#0f3b2e] text-white"
                      : isForYou
                      ? "bg-white/10 text-white/30"
                      : "bg-[#0f3b2e]/25 text-white/50"
                  }`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M21 3 10 14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="m21 3-7 18-4-7-7-4 18-7Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
              {errorMsg ? (
                <p className={`text-xs ${isForYou ? "text-red-300" : "text-red-700"}`}>{errorMsg}</p>
              ) : null}
            </form>
          ) : (
            <div className="space-y-2">
              <p className={`text-sm ${isForYou ? "text-white/68" : "text-[#0f3b2e]/72"}`}>
                Melde dich an, um einen Kommentar zu schreiben.
              </p>
              <button
                type="button"
                onClick={onRequireAuth}
                className={`rounded-2xl px-4 py-3 text-sm font-semibold transition hover:opacity-95 ${
                  isForYou ? "bg-white text-[#1f1f1f]" : "bg-[#0f3b2e] text-white"
                }`}
              >
                Jetzt einloggen
              </button>
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body
  );
}
