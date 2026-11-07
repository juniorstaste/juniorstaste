const MESSAGES_RETURN_PATH_KEY = "messages_return_path";
const PENDING_CONVERSATION_KEY = "messages_pending_conversation";

function isSafeInternalPath(path: string | null): path is string {
  return Boolean(path?.startsWith("/") && !path.startsWith("//"));
}

export function rememberMessagesOrigin() {
  if (typeof window === "undefined") return;
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (window.location.pathname.startsWith("/messages")) return;
  window.sessionStorage.setItem(MESSAGES_RETURN_PATH_KEY, currentPath);
}

export function takeMessagesReturnPath() {
  if (typeof window === "undefined") return "/for-you";
  const storedPath = window.sessionStorage.getItem(MESSAGES_RETURN_PATH_KEY);
  window.sessionStorage.removeItem(MESSAGES_RETURN_PATH_KEY);
  return isSafeInternalPath(storedPath) && !storedPath.startsWith("/messages")
    ? storedPath
    : "/for-you";
}

export function queueConversationAfterInbox(conversationId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PENDING_CONVERSATION_KEY, conversationId);
}

export function takePendingConversationId() {
  if (typeof window === "undefined") return null;
  const conversationId = window.sessionStorage.getItem(PENDING_CONVERSATION_KEY);
  window.sessionStorage.removeItem(PENDING_CONVERSATION_KEY);
  return conversationId && /^[0-9a-f-]{36}$/i.test(conversationId) ? conversationId : null;
}
