"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MessagesHeader from "@/components/MessagesHeader";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { takeMessagesReturnPath, takePendingConversationId } from "@/lib/messageNavigation";

type InboxRow = {
  conversation_id: string;
  other_user_id: string;
  other_display_name: string;
  last_message_type: "text" | "spot" | null;
  last_message_body: string | null;
  last_spot_name: string | null;
  last_message_at: string | null;
  unread_count: number;
};

function preview(row: InboxRow) {
  if (!row.last_message_type) return "Noch keine Nachrichten";
  if (row.last_message_type === "spot") return row.last_spot_name ? `Spot: ${row.last_spot_name}` : "Spot nicht mehr verfügbar";
  return row.last_message_body ?? "Nachricht";
}

export default function MessagesPage() {
  const router = useRouter();
  const { user, authLoading, openAuthPrompt } = useAuth();
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadInbox = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc("get_inbox");
    if (!error) setRows((data ?? []) as InboxRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    // The fetch resolves asynchronously before it updates the inbox state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`inbox:${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => void loadInbox())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversation_members", filter: `user_id=eq.${user.id}` }, () => void loadInbox())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadInbox, user]);

  useEffect(() => {
    const pendingConversationId = takePendingConversationId();
    if (pendingConversationId) router.push(`/messages/${pendingConversationId}`);
  }, [router]);

  function handleBack() {
    router.replace(takeMessagesReturnPath());
  }

  if (!authLoading && !user) {
    return (
      <main className="min-h-screen bg-[#f6efe3]">
        <MessagesHeader title="Nachrichten" onBack={handleBack} />
        <div className="mx-auto max-w-md px-5 py-16 text-center">
          <h2 className="text-xl font-extrabold text-[#0f3b2e]">Deine Chats warten auf dich</h2>
          <p className="mt-3 text-sm text-[#0f3b2e]/70">Melde dich an, um Spots und Nachrichten zu senden.</p>
          <button onClick={() => openAuthPrompt()} className="mt-6 rounded-2xl bg-[#0f3b2e] px-6 py-3 font-bold text-white">Anmelden</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6efe3] pb-28">
      <MessagesHeader title="Nachrichten" onBack={handleBack} />
      <section className="mx-auto max-w-2xl px-4 py-4">
        {loading ? <p className="py-12 text-center text-[#0f3b2e]/60">Chats werden geladen…</p> : null}
        {!loading && rows.length === 0 ? (
          <div className="rounded-3xl bg-white/70 px-6 py-12 text-center shadow-sm">
            <p className="font-bold text-[#0f3b2e]">Noch keine Chats</p>
            <p className="mt-2 text-sm text-[#0f3b2e]/65">Sende bei einem Spot über den Papierflieger deine erste Empfehlung.</p>
          </div>
        ) : null}
        <div className="space-y-2">
          {rows.map((row) => (
            <Link key={row.conversation_id} href={`/messages/${row.conversation_id}`} className="flex items-center gap-3 rounded-2xl bg-white/75 p-4 shadow-sm transition hover:bg-white">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0f3b2e] text-lg font-extrabold text-white">{row.other_display_name.slice(0, 1).toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-[#0f3b2e]">{row.other_display_name}</p>
                <p className="truncate text-sm text-[#0f3b2e]/65">{preview(row)}</p>
              </div>
              {Number(row.unread_count) > 0 ? <span className="min-w-6 rounded-full bg-[#d85c3f] px-2 py-1 text-center text-xs font-bold text-white">{row.unread_count}</span> : null}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
