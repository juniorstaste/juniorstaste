"use client";

import Link from "next/link";
import { Heart, Play } from "@phosphor-icons/react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, MouseEvent, PointerEvent, TouchEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import MessagesHeader from "@/components/MessagesHeader";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { getSpotVideoThumbnailUrl, type ChatMessage } from "@/lib/messaging";

const DOUBLE_TAP_DELAY_MS = 300;

function MessageReaction({
  count,
  own,
  canRemove,
  onRemoveRequest,
}: {
  count: number;
  own: boolean;
  canRemove: boolean;
  onRemoveRequest: () => void;
}) {
  if (count === 0) return null;

  const className = `absolute -bottom-2 z-10 flex items-center gap-0.5 font-bold text-[#EF3340] ${own ? "-left-1" : "-right-1"}`;
  const content = (
    <>
      <Heart
        size={25}
        weight="fill"
        color="#EF3340"
        fill="#EF3340"
        stroke="#EF3340"
        aria-hidden="true"
      />
      {count > 1 ? <span className="text-[11px] leading-none">{count}</span> : null}
    </>
  );

  return canRemove ? (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onRemoveRequest();
      }}
      className={`${className} touch-manipulation`}
      aria-label="Gefällt mir verwalten"
    >
      {content}
    </button>
  ) : (
    <span className={`${className} pointer-events-none`} aria-label={`${count} ${count === 1 ? "Like" : "Likes"}`}>
      {content}
    </span>
  );
}

function ReactionBottomSheet({ onClose, onRemove }: { onClose: () => void; onRemove: () => void }) {
  const [entered, setEntered] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragStartYRef = useRef(0);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setEntered(true));
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function handleDragStart(event: PointerEvent<HTMLDivElement>) {
    dragPointerIdRef.current = event.pointerId;
    dragStartYRef.current = event.clientY;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleDragMove(event: PointerEvent<HTMLElement>) {
    if (dragPointerIdRef.current !== event.pointerId) return;
    setDragOffset(Math.max(0, event.clientY - dragStartYRef.current));
  }

  function finishDrag(pointerId: number) {
    if (dragPointerIdRef.current !== pointerId) return;
    dragPointerIdRef.current = null;
    setIsDragging(false);
    if (dragOffset > 80) onClose();
    else setDragOffset(0);
  }

  return createPortal(
    <div className="fixed inset-0 z-[4600]">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/30"
        aria-label="Reaktionsmenü schließen"
      />
      <section
        onPointerMove={handleDragMove}
        onPointerUp={(event) => finishDrag(event.pointerId)}
        onPointerCancel={(event) => finishDrag(event.pointerId)}
        className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-[560px] rounded-t-[28px] border border-white/20 bg-[#f6efe3] px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-3 text-[#0f3b2e] shadow-2xl"
        style={{
          transform: entered ? `translateY(${dragOffset}px)` : "translateY(100%)",
          transition: isDragging ? "none" : "transform 220ms ease-out",
        }}
        aria-label="Nachrichtenreaktion"
      >
        <div onPointerDown={handleDragStart} className="touch-none pb-4 pt-1">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-[#0f3b2e]/20" />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="flex w-full items-center gap-3 rounded-2xl bg-white/75 px-4 py-4 text-left font-bold text-[#0f3b2e] transition active:scale-[0.99]"
        >
          <Heart size={24} weight="fill" color="#EF3340" fill="#EF3340" stroke="#EF3340" aria-hidden="true" />
          <span>Gefällt mir entfernen</span>
        </button>
      </section>
    </div>,
    document.body
  );
}

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, authLoading } = useAuth();
  const conversationId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [title, setTitle] = useState("Chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [reactionsAvailable, setReactionsAvailable] = useState(false);
  const [reactionSheetMessageId, setReactionSheetMessageId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const messageInputRef = useRef<HTMLInputElement | null>(null);
  const historyTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const dismissedKeyboardForTouchRef = useRef(false);
  const messageTapRef = useRef(new Map<string, { tappedAt: number; timer: number }>());
  const pendingReactionIdsRef = useRef(new Set<string>());

  function handleHistoryTouchStart(event: TouchEvent<HTMLElement>) {
    const touch = event.touches[0];
    if (!touch) return;
    historyTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
    dismissedKeyboardForTouchRef.current = false;
  }

  function handleHistoryTouchMove(event: TouchEvent<HTMLElement>) {
    const start = historyTouchStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch || dismissedKeyboardForTouchRef.current) return;

    const horizontalDistance = Math.abs(touch.clientX - start.x);
    const upwardDistance = start.y - touch.clientY;
    if (upwardDistance < 12 || upwardDistance <= horizontalDistance) return;
    if (document.activeElement !== messageInputRef.current) return;

    dismissedKeyboardForTouchRef.current = true;
    messageInputRef.current?.blur();
  }

  function handleHistoryTouchEnd() {
    historyTouchStartRef.current = null;
    dismissedKeyboardForTouchRef.current = false;
  }

  const markRead = useCallback(async (lastVisibleMessageAt: string | undefined) => {
    if (!user || !lastVisibleMessageAt) return;
    await supabase.from("conversation_members").update({ last_read_at: lastVisibleMessageAt }).eq("conversation_id", conversationId).eq("user_id", user.id);
  }, [conversationId, user]);

  const loadMessages = useCallback(async () => {
    if (!user) return;
    const [{ data, error }, header] = await Promise.all([
      supabase.from("messages").select("id, conversation_id, sender_id, type, body, spot_id, created_at, spots(id, name, image_url)").eq("conversation_id", conversationId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(200),
      supabase.rpc("get_conversation_header", { target_conversation_id: conversationId }),
    ]);
    if (error || header.error || !header.data?.length) { router.replace("/messages"); return; }
    const newestFirst = (data ?? []) as unknown as Omit<ChatMessage, "direct_message_reactions">[];
    const messageIds = newestFirst.map((message) => message.id);
    const reactionsByMessage = new Map<string, ChatMessage["direct_message_reactions"]>();

    if (messageIds.length > 0) {
      const reactionsResult = await supabase
        .from("direct_message_reactions")
        .select("message_id, user_id, is_active")
        .in("message_id", messageIds);

      setReactionsAvailable(!reactionsResult.error);
      for (const reaction of reactionsResult.data ?? []) {
        const reactions = reactionsByMessage.get(reaction.message_id) ?? [];
        reactions.push({ user_id: reaction.user_id, is_active: reaction.is_active });
        reactionsByMessage.set(reaction.message_id, reactions);
      }
    } else {
      setReactionsAvailable(false);
    }

    const messagesWithReactions = newestFirst.map((message) => ({
      ...message,
      direct_message_reactions: reactionsByMessage.get(message.id) ?? [],
    }));
    setMessages([...messagesWithReactions].reverse());
    setTitle(header.data?.[0]?.other_display_name ?? "Chat");
    await markRead(newestFirst[0]?.created_at);
  }, [conversationId, markRead, router, user]);

  useEffect(() => { if (!authLoading && !user) router.replace("/messages"); }, [authLoading, router, user]);
  useEffect(() => {
    // The fetch resolves asynchronously before it updates the chat state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMessages();
  }, [loadMessages]);
  const lastMessageId = messages.at(-1)?.id;
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [lastMessageId]);

  useEffect(() => {
    if (!user) return;
    let channel = supabase
      .channel(`conversation:${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, () => void loadMessages());
    if (reactionsAvailable) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table: "direct_message_reactions" }, () => void loadMessages());
    }
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [conversationId, loadMessages, reactionsAvailable, user]);

  async function likeMessage(message: ChatMessage) {
    if (!user || !reactionsAvailable || pendingReactionIdsRef.current.has(message.id)) return;

    const currentReaction = message.direct_message_reactions.find(
      (reaction) => reaction.user_id === user.id
    );
    if (currentReaction?.is_active) return;

    pendingReactionIdsRef.current.add(message.id);

    setMessages((currentMessages) => currentMessages.map((currentMessage) => {
      if (currentMessage.id !== message.id) return currentMessage;
      const otherReactions = currentMessage.direct_message_reactions.filter(
        (reaction) => reaction.user_id !== user.id
      );
      return {
        ...currentMessage,
        direct_message_reactions: [
          ...otherReactions,
          { user_id: user.id, is_active: true },
        ],
      };
    }));

    const { error } = currentReaction
      ? await supabase
          .from("direct_message_reactions")
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .eq("message_id", message.id)
          .eq("user_id", user.id)
      : await supabase.from("direct_message_reactions").insert({
          message_id: message.id,
          user_id: user.id,
          is_active: true,
        });

    pendingReactionIdsRef.current.delete(message.id);
    if (error) {
      console.error("Nachrichten-Like konnte nicht gespeichert werden:", error);
      await loadMessages();
    }
  }

  async function removeOwnLike(messageId: string) {
    if (!user || pendingReactionIdsRef.current.has(messageId)) return;
    const message = messages.find((candidate) => candidate.id === messageId);
    const ownReaction = message?.direct_message_reactions.find(
      (reaction) => reaction.user_id === user.id && reaction.is_active
    );
    if (!ownReaction) {
      setReactionSheetMessageId(null);
      return;
    }

    pendingReactionIdsRef.current.add(messageId);
    setReactionSheetMessageId(null);
    setMessages((currentMessages) => currentMessages.map((currentMessage) => ({
      ...currentMessage,
      direct_message_reactions: currentMessage.id === messageId
        ? currentMessage.direct_message_reactions.map((reaction) =>
            reaction.user_id === user.id ? { ...reaction, is_active: false } : reaction
          )
        : currentMessage.direct_message_reactions,
    })));

    const { error } = await supabase
      .from("direct_message_reactions")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("message_id", messageId)
      .eq("user_id", user.id);

    pendingReactionIdsRef.current.delete(messageId);
    if (error) {
      console.error("Nachrichten-Like konnte nicht entfernt werden:", error);
      await loadMessages();
    }
  }

  function handleMessageClick(event: MouseEvent<HTMLElement>, message: ChatMessage, href?: string) {
    if (href) event.preventDefault();

    const now = event.timeStamp;
    const previousTap = messageTapRef.current.get(message.id);
    if (previousTap && now - previousTap.tappedAt <= DOUBLE_TAP_DELAY_MS) {
      window.clearTimeout(previousTap.timer);
      messageTapRef.current.delete(message.id);
      void likeMessage(message);
      return;
    }

    if (previousTap) window.clearTimeout(previousTap.timer);
    const timer = window.setTimeout(() => {
      messageTapRef.current.delete(message.id);
      if (href) router.push(href);
    }, DOUBLE_TAP_DELAY_MS);
    messageTapRef.current.set(message.id, { tappedAt: now, timer });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!user || !body || sending) return;
    setSending(true);
    setSendError(null);
    const { error } = await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: user.id, type: "text", body });
    if (!error) { setText(""); await loadMessages(); }
    else setSendError("Nachricht konnte nicht gesendet werden. Bitte versuche es erneut.");
    setSending(false);
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#f6efe3]">
      <MessagesHeader title={title} onBack={() => router.replace("/messages")} />
      <section
        className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-28 pt-4"
        onTouchStart={handleHistoryTouchStart}
        onTouchMove={handleHistoryTouchMove}
        onTouchEnd={handleHistoryTouchEnd}
        onTouchCancel={handleHistoryTouchEnd}
      >
        <div className="flex-1 space-y-3">
          {messages.map((message) => {
            const own = message.sender_id === user?.id;
            const reactionCount = message.direct_message_reactions.filter(
              (reaction) => reaction.is_active
            ).length;
            const ownReactionActive = message.direct_message_reactions.some(
              (reaction) => reaction.user_id === user?.id && reaction.is_active
            );
            return <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
              {message.type === "spot" && message.spots ? (
                <div className="relative w-[clamp(180px,52vw,205px)] max-w-[78%]">
                  <Link
                    href={`/spot/${message.spots.id}`}
                    onClick={(event) => handleMessageClick(event, message, `/spot/${message.spots!.id}`)}
                    className="block touch-manipulation overflow-hidden rounded-2xl bg-white shadow-sm"
                  >
                    <div className="relative aspect-[9/16] bg-[#d8ccb7]">
                      {getSpotVideoThumbnailUrl(message.spots.id) ? (
                        <img
                          src={getSpotVideoThumbnailUrl(message.spots.id)!}
                          alt={message.spots.name}
                          className="h-full w-full object-cover"
                          onError={(event) => {
                            const image = event.currentTarget;
                            image.onerror = null;
                            if (message.spots?.image_url) image.src = message.spots.image_url;
                            else image.hidden = true;
                          }}
                        />
                      ) : message.spots.image_url ? (
                        <img src={message.spots.image_url} alt={message.spots.name} className="h-full w-full object-cover" />
                      ) : null}
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/45 text-white shadow-lg backdrop-blur-sm">
                          <Play size={24} weight="fill" className="translate-x-px" />
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-[#0f3b2e]">{message.spots.name}</p>
                        <p className="mt-1 text-xs text-[#0f3b2e]/60">Spot ansehen</p>
                      </div>
                      {message.spots.image_url ? (
                        <img
                          src={message.spots.image_url}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-full object-cover"
                          aria-hidden="true"
                        />
                      ) : null}
                    </div>
                  </Link>
                  <MessageReaction
                    count={reactionCount}
                    own={own}
                    canRemove={ownReactionActive}
                    onRemoveRequest={() => setReactionSheetMessageId(message.id)}
                  />
                </div>
              ) : message.type === "spot" ? (
                <div className="relative w-[min(78%,290px)]">
                  <div
                    onClick={(event) => handleMessageClick(event, message)}
                    className="touch-manipulation rounded-2xl bg-white p-4 text-sm font-semibold text-[#0f3b2e]/70 shadow-sm"
                  >
                    Spot nicht mehr verfügbar
                  </div>
                  <MessageReaction
                    count={reactionCount}
                    own={own}
                    canRemove={ownReactionActive}
                    onRemoveRequest={() => setReactionSheetMessageId(message.id)}
                  />
                </div>
              ) : (
                <div className="relative max-w-[78%]">
                  <div
                    onClick={(event) => handleMessageClick(event, message)}
                    className={`touch-manipulation rounded-2xl px-4 py-3 text-sm ${own ? "rounded-br-md bg-[#0f3b2e] text-white" : "rounded-bl-md bg-white text-[#0f3b2e] shadow-sm"}`}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  </div>
                  <MessageReaction
                    count={reactionCount}
                    own={own}
                    canRemove={ownReactionActive}
                    onRemoveRequest={() => setReactionSheetMessageId(message.id)}
                  />
                </div>
              )}
            </div>;
          })}
          <div ref={endRef} />
        </div>
      </section>
      <form onSubmit={submit} className="fixed inset-x-0 bottom-0 z-20 border-t border-[#d8ccb7] bg-[#f6efe3]/95 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl gap-2">
          <input ref={messageInputRef} value={text} onChange={(event) => setText(event.target.value)} maxLength={2000} placeholder="Nachricht schreiben…" className="min-w-0 flex-1 rounded-2xl border border-[#d8ccb7] bg-white px-4 py-3 text-sm text-[#0f3b2e] outline-none focus:border-[#0f3b2e]" />
          <button disabled={!text.trim() || sending} className="rounded-2xl bg-[#0f3b2e] px-5 font-bold text-white disabled:opacity-40">Senden</button>
        </div>
        {sendError ? <p role="alert" className="mx-auto mt-2 max-w-2xl text-sm text-[#b33a2b]">{sendError}</p> : null}
      </form>
      {reactionSheetMessageId ? (
        <ReactionBottomSheet
          onClose={() => setReactionSheetMessageId(null)}
          onRemove={() => void removeOwnLike(reactionSheetMessageId)}
        />
      ) : null}
    </main>
  );
}
