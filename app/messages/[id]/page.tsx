"use client";

import Link from "next/link";
import { Play } from "@phosphor-icons/react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import MessagesHeader from "@/components/MessagesHeader";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { getSpotVideoThumbnailUrl, type ChatMessage } from "@/lib/messaging";

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
  const endRef = useRef<HTMLDivElement | null>(null);

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
    const newestFirst = (data ?? []) as unknown as ChatMessage[];
    setMessages([...newestFirst].reverse());
    setTitle(header.data?.[0]?.other_display_name ?? "Chat");
    await markRead(newestFirst[0]?.created_at);
  }, [conversationId, markRead, router, user]);

  useEffect(() => { if (!authLoading && !user) router.replace("/messages"); }, [authLoading, router, user]);
  useEffect(() => {
    // The fetch resolves asynchronously before it updates the chat state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMessages();
  }, [loadMessages]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`conversation:${conversationId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, () => void loadMessages()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [conversationId, loadMessages, user]);

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
      <MessagesHeader title={title} backHref="/messages" />
      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-28 pt-4">
        <div className="flex-1 space-y-3">
          {messages.map((message) => {
            const own = message.sender_id === user?.id;
            return <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
              {message.type === "spot" && message.spots ? (
                <Link href={`/spot/${message.spots.id}`} className="w-[clamp(180px,52vw,205px)] max-w-[78%] overflow-hidden rounded-2xl bg-white shadow-sm">
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
              ) : message.type === "spot" ? (
                <div className="w-[min(78%,290px)] rounded-2xl bg-white p-4 text-sm font-semibold text-[#0f3b2e]/70 shadow-sm">
                  Spot nicht mehr verfügbar
                </div>
              ) : (
                <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm ${own ? "rounded-br-md bg-[#0f3b2e] text-white" : "rounded-bl-md bg-white text-[#0f3b2e] shadow-sm"}`}>
                  <p className="whitespace-pre-wrap break-words">{message.body}</p>
                </div>
              )}
            </div>;
          })}
          <div ref={endRef} />
        </div>
      </section>
      <form onSubmit={submit} className="fixed inset-x-0 bottom-0 z-20 border-t border-[#d8ccb7] bg-[#f6efe3]/95 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl gap-2">
          <input value={text} onChange={(event) => setText(event.target.value)} maxLength={2000} placeholder="Nachricht schreiben…" className="min-w-0 flex-1 rounded-2xl border border-[#d8ccb7] bg-white px-4 py-3 text-sm text-[#0f3b2e] outline-none focus:border-[#0f3b2e]" />
          <button disabled={!text.trim() || sending} className="rounded-2xl bg-[#0f3b2e] px-5 font-bold text-white disabled:opacity-40">Senden</button>
        </div>
        {sendError ? <p role="alert" className="mx-auto mt-2 max-w-2xl text-sm text-[#b33a2b]">{sendError}</p> : null}
      </form>
    </main>
  );
}
