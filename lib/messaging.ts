import { supabase } from "@/lib/supabaseClient";

export type MessageKind = "text" | "spot";

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: MessageKind;
  body: string | null;
  spot_id: string | null;
  created_at: string;
  spots: { id: string; name: string; image_url: string | null } | null;
};

export function getSpotVideoThumbnailUrl(spotId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  return `${supabaseUrl}/storage/v1/object/public/spot-images/video-thumbnails/${encodeURIComponent(spotId)}.jpg`;
}

export async function startConversation(otherUserId: string) {
  const { data, error } = await supabase.rpc("start_direct_conversation", {
    other_user_id: otherUserId,
  });
  if (error) throw error;
  return data as string;
}

export async function sendSpotMessage(conversationId: string, userId: string, spotId: string) {
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: userId,
    type: "spot",
    spot_id: spotId,
  });
  if (error) throw error;
}
