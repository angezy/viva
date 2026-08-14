const DEFAULT_CHAT_CONFIG = {
  enabled: true,
  title: "Weluxo AI Concierge",
  subtitle: "Answers from the Weluxo help library",
  greeting: "Hi - I'm the Weluxo AI Concierge. What can I help you find today?",
  placeholder: "Ask about orders, shipping...",
  triggerLabel: "Open live chat",
  thinking: "Thinking...",
  fallback: "I could not find an exact answer in the Weluxo help library. Try asking about shipping, an order, returns, payments, products, or your account.",
  error: "I'm temporarily unavailable. Please try again.",
};

function envText(name, fallback) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function getChatConfig() {
  return {
    enabled: process.env.WELUXO_CHAT_ENABLED !== "false",
    title: envText("WELUXO_CHAT_TITLE", DEFAULT_CHAT_CONFIG.title),
    subtitle: envText("WELUXO_CHAT_SUBTITLE", DEFAULT_CHAT_CONFIG.subtitle),
    greeting: envText("WELUXO_CHAT_GREETING", DEFAULT_CHAT_CONFIG.greeting),
    placeholder: envText("WELUXO_CHAT_PLACEHOLDER", DEFAULT_CHAT_CONFIG.placeholder),
    triggerLabel: envText("WELUXO_CHAT_TRIGGER_LABEL", DEFAULT_CHAT_CONFIG.triggerLabel),
    thinking: envText("WELUXO_CHAT_THINKING", DEFAULT_CHAT_CONFIG.thinking),
    fallback: envText("WELUXO_CHAT_FALLBACK", DEFAULT_CHAT_CONFIG.fallback),
    error: envText("WELUXO_CHAT_ERROR", DEFAULT_CHAT_CONFIG.error),
  };
}
