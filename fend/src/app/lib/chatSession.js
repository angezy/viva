const CHAT_SESSION_PREFIX = "weluxoChat";

export function chatMessagesStorageKey(conversationId) {
  return `${CHAT_SESSION_PREFIX}Messages:${conversationId}`;
}

export function loadSessionChatMessages(conversationId) {
  if (typeof window === "undefined" || !conversationId) return [];
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(chatMessagesStorageKey(conversationId)) || "[]");
    if (!Array.isArray(stored)) return [];
    return stored
      .filter((message) => (message?.role === "user" || message?.role === "assistant") && typeof message?.text === "string")
      .map((message) => ({
        role: message.role,
        text: message.text,
        ...(message.messageId ? { messageId: message.messageId } : {}),
        ...(message.createdAt ? { createdAt: message.createdAt } : {}),
      }));
  } catch (_error) {
    return [];
  }
}

export function saveSessionChatMessages(conversationId, messages) {
  if (typeof window === "undefined" || !conversationId) return;
  try {
    const stored = (Array.isArray(messages) ? messages : [])
      .filter((message) => !message.system && (message.role === "user" || message.role === "assistant") && message.text)
      .slice(-100)
      .map((message) => ({
        role: message.role,
        text: message.text,
        ...(message.messageId ? { messageId: message.messageId } : {}),
        ...(message.createdAt ? { createdAt: message.createdAt } : {}),
      }));
    window.sessionStorage.setItem(chatMessagesStorageKey(conversationId), JSON.stringify(stored));
  } catch (_error) {
    // Browser session storage is optional.
  }
}

export function clearLiveChatSession() {
  if (typeof window === "undefined") return;
  try {
    const keys = [];
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(CHAT_SESSION_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => window.sessionStorage.removeItem(key));
  } catch (_error) {
    // Browser session storage is optional.
  }
}

export async function endLiveChatSession() {
  if (typeof window === "undefined") return;
  let conversationId = "";
  try {
    conversationId = window.sessionStorage.getItem("weluxoChatConversationId") || "";
    const conversationToken = window.sessionStorage.getItem("weluxoChatConversationToken") || "";
    if (conversationId) {
      await fetch("/api/chat/session", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, conversationToken }),
        cache: "no-store",
      });
    }
  } catch (_error) {
    // Logout must continue even if server-side chat cleanup is unavailable.
  } finally {
    clearLiveChatSession();
  }
}
