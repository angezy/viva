import { NextResponse } from "next/server";
import helpContent from "../../../../data/help-center.json";
import { getChatConfig } from "../../lib/chatConfig";

function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function tokenize(value) {
  return clean(value).toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2);
}

function buildKnowledge(content) {
  const faqItems = Array.isArray(content?.faq?.items) ? content.faq.items : [];
  const categoryItems = Array.isArray(content?.categories?.items) ? content.categories.items : [];
  const articleItems = categoryItems.flatMap((category) => (Array.isArray(category.articles) ? category.articles : []).map((article) => ({
    question: article,
    answer: `Please review the ${category.title || "relevant"} guidance in the Help section, or ask me a more specific question.`,
  })));
  return [...faqItems, ...articleItems];
}

function answerFor(message, config) {
  const question = clean(message);
  const normalized = question.toLowerCase();
  if (!question) return "Tell me what you need help with, such as an order, shipping, returns, payment, or a product.";
  if (/^(hi|hello|hey|good morning|good afternoon)\b/.test(normalized)) return config.greeting;

  const knowledge = buildKnowledge(helpContent);
  const words = tokenize(question);
  const ranked = knowledge
    .map((item) => {
      const source = `${item.question || ""} ${item.answer || ""}`.toLowerCase();
      const score = words.reduce((total, word) => total + (source.includes(word) ? 1 : 0), 0) + (source.includes(normalized) ? 3 : 0);
      return { item, score };
    })
    .sort((left, right) => right.score - left.score);

  if (ranked[0]?.score > 0) return ranked[0].item.answer || "I found a related answer, but it does not include any additional details.";
  if (/order|track|package|delivery|ship/.test(normalized)) return "For an order update, use the Track Your Order option with your order number and checkout email.";
  if (/return|refund|exchange/.test(normalized)) return "Returns and refunds are handled according to our Return & Refund Policy. Include your order number if you contact support.";
  if (/payment|checkout|card|charge/.test(normalized)) return "Payment options are shown securely during checkout. If payment fails, confirm your details and try another available method.";
  if (/account|password|sign in|login/.test(normalized)) return "You can manage account details after signing in. Use the sign-in page password reset option if you cannot access your account.";
  return config.fallback;
}

async function notifyHumanSupport(conversationId, message, visitor = {}) {
  const backendUrl = String(process.env.BACKEND_URL || "").trim().replace(/\/$/, "");
  if (!backendUrl || !conversationId) return { humanSupport: false };
  try {
    const response = await fetch(`${backendUrl}/api/chat/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, message, name: visitor.name, email: visitor.email }),
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    return response.ok ? data : { humanSupport: false };
  } catch (error) {
    console.warn("Telegram human-support notification failed:", error && error.message ? error.message : error);
    return { humanSupport: false };
  }
}

export async function POST(request) {
  try {
    const config = getChatConfig();
    if (!config.enabled) return NextResponse.json({ error: "Chat is currently unavailable" }, { status: 503 });
    const body = await request.json();
    const message = clean(body?.message);
    const conversationId = clean(body?.conversationId).slice(0, 80);
    const name = clean(body?.name).slice(0, 200);
    const email = clean(body?.email).slice(0, 255);
    if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });
    const humanSupport = await notifyHumanSupport(conversationId, message, { name, email });
    const isHumanHandoff = Boolean(humanSupport.humanSupport);
    return NextResponse.json({
      reply: isHumanHandoff
        ? "Thanks — your message has been sent to our support team. A team member will reply here shortly."
        : answerFor(message, config),
      conversationId,
      humanSupport: isHumanHandoff,
    });
  } catch (_error) {
    return NextResponse.json({ error: "Unable to answer right now" }, { status: 500 });
  }
}
