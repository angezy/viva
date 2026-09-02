import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getChatConfig } from "../../lib/chatConfig";
import { readAIKnowledge } from "../../lib/aiKnowledge";

const HUMAN_HANDOFF_MESSAGE = "I'll connect you with a Weluxo support specialist.";
const dataDirectory = path.join(process.cwd(), "data");
const approvedFiles = ["faq.json", "help-center.json", "shipping-policy.json", "return-refund-policy.json", "terms-conditions.json", "privacy-policy.json"];
const stopWords = new Set(["a", "an", "and", "are", "can", "do", "does", "for", "how", "i", "is", "it", "me", "my", "of", "on", "or", "the", "to", "what", "when", "where", "with", "you", "your"]);

function clean(value, max = 4000) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function normalized(value) {
  return clean(value).toLowerCase();
}

function tokens(value) {
  return [...new Set(normalized(value).split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !stopWords.has(word)))];
}

async function readApprovedStoreFiles() {
  const entries = await Promise.all(approvedFiles.map(async (filename) => {
    try {
      return [filename, JSON.parse(await fs.readFile(path.join(dataDirectory, filename), "utf8"))];
    } catch (error) {
      console.error(`Unable to load approved chat data ${filename}`, error);
      return [filename, null];
    }
  }));
  return Object.fromEntries(entries);
}

function addFAQEntries(items, source, destination) {
  (Array.isArray(items) ? items : []).forEach((item, index) => {
    const title = clean(item?.question, 300);
    const content = clean(item?.answer, 6000);
    if (title && content) destination.push({ id: `${source}-faq-${index}`, source, title, content, keywords: [] });
  });
}

function addPolicyEntries(policy, source, destination) {
  (Array.isArray(policy?.sections) ? policy.sections : []).forEach((section, index) => {
    const title = clean(section?.title, 300);
    const content = clean(section?.body, 6000);
    if (title && content) destination.push({ id: `${source}-section-${index}`, source, title, content, keywords: [] });
  });
  addFAQEntries(policy?.faq?.items, source, destination);
}

function buildApprovedKnowledge(files, customKnowledge) {
  const entries = [];
  addFAQEntries(files["faq.json"]?.faq?.items, "Store FAQ", entries);
  addFAQEntries(files["help-center.json"]?.faq?.items, "Help Center", entries);
  addPolicyEntries(files["shipping-policy.json"], "Shipping Policy", entries);
  addPolicyEntries(files["return-refund-policy.json"], "Return & Refund Policy", entries);
  addPolicyEntries(files["terms-conditions.json"], "Terms & Conditions", entries);
  addPolicyEntries(files["privacy-policy.json"], "Privacy Policy", entries);
  (customKnowledge?.entries || []).filter((entry) => entry.enabled).forEach((entry) => {
    entries.push({
      id: `admin-${entry.id}`,
      source: entry.category === "product_guidance" ? "Product guidance" : entry.category === "policy" ? "Store policy" : "Store FAQ",
      title: clean(entry.title, 300),
      content: clean(entry.content, 6000),
      keywords: Array.isArray(entry.keywords) ? entry.keywords : [],
    });
  });
  return entries.filter((entry) => entry.title && entry.content);
}

function rankKnowledge(question, entries) {
  const query = normalized(question);
  const queryTokens = tokens(question);
  if (!queryTokens.length) return [];
  return entries.map((entry) => {
    const title = normalized(entry.title);
    const content = normalized(entry.content);
    const keywordText = normalized((entry.keywords || []).join(" "));
    let score = 0;
    let titleMatches = 0;
    queryTokens.forEach((token) => {
      if (title.includes(token)) { score += 4; titleMatches += 1; }
      if (keywordText.includes(token)) score += 3;
      if (content.includes(token)) score += 1;
    });
    if (query.length > 8 && title.includes(query)) score += 8;
    if (title.length > 8 && query.includes(title)) score += 8;
    return { entry, score, titleMatches };
  }).sort((left, right) => right.score - left.score);
}

function approvedSources(question, entries) {
  const ranked = rankKnowledge(question, entries);
  const best = ranked[0];
  if (!best || best.score < 5 || (!best.titleMatches && best.score < 8)) return [];
  return ranked
    .filter((candidate) => candidate.score >= Math.max(4, best.score - 4))
    .slice(0, 4)
    .map((candidate) => candidate.entry);
}

function asksForSpecialist(message) {
  return /\b(human|real person|person|agent|support specialist|talk to|speak to|representative)\b/i.test(message);
}

function orderCredentials(message) {
  const email = (normalized(message).match(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/) || [])[0] || "";
  const patterns = [/(?:order\s*(?:number|no\.?|id)?\s*[:#-]?\s*)([a-z0-9][a-z0-9_-]{2,63})/i, /#\s*([a-z0-9][a-z0-9_-]{2,63})/i];
  const match = patterns.map((pattern) => message.match(pattern)).find(Boolean);
  return { email, orderNumber: match ? clean(match[1], 64) : "" };
}

function isOrderDetailQuestion(message) {
  const query = normalized(message);
  return /\b(my\s+(order|package|delivery)|where\s+is\s+(my\s+)?(order|package)|track\s+(my|an)\s+order|order\s*(number|no\.?|id|#)|order\s+status|tracking\s+(number|status)|delivery\s+status)\b/.test(query);
}

function isGreeting(message) {
  return /^(hi|hello|hey|good morning|good afternoon|good evening)[!.? ]*$/i.test(clean(message));
}

function isStockQuestion(message) {
  return /\b(stock|in stock|out of stock|available|availability|inventory)\b/i.test(message);
}

function productNameScore(question, product) {
  const titleTokens = tokens(product?.title || product?.name || "");
  const query = normalized(question);
  const title = normalized(product?.title || product?.name || "");
  if (!titleTokens.length || !title) return 0;
  const matches = titleTokens.filter((token) => query.includes(token)).length;
  if (query.includes(title)) return 100 + matches;
  return matches >= Math.max(1, Math.ceil(titleTokens.length / 2)) ? matches * 10 : 0;
}

async function liveProducts() {
  const backendUrl = String(process.env.BACKEND_URL || "").trim().replace(/\/$/, "");
  if (!backendUrl) return [];
  try {
    const response = await fetch(`${backendUrl}/api/shop`, { cache: "no-store" });
    if (!response.ok) return [];
    const products = await response.json();
    return Array.isArray(products) ? products : [];
  } catch (error) {
    console.warn("Unable to load live chat product data", error?.message || error);
    return [];
  }
}

function productAnswer(question, products) {
  const ranked = products.map((product) => ({ product, score: productNameScore(question, product) })).filter((item) => item.score > 0).sort((left, right) => right.score - left.score);
  if (ranked.length !== 1 || (ranked[1] && ranked[1].score === ranked[0].score)) return null;
  const product = ranked[0].product;
  const title = clean(product.title || product.name, 300);
  if (!title) return null;
  if (isStockQuestion(question)) {
    const stock = Number(product.stock);
    if (!Number.isFinite(stock)) return null;
    return { id: "live-product-inventory", source: "Live product inventory", content: `${title} is currently ${stock > 0 ? "in stock" : "out of stock"} (${stock} available).` };
  }
  const description = clean(product.description, 6000);
  return description ? { id: "live-product-catalog", source: "Live product catalog", content: description } : null;
}

function parseModelJson(value) {
  const text = String(value || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(text); } catch (_error) { return null; }
}

async function askGroq(question, sources) {
  const apiKey = String(process.env.GROQ_API_KEY || "").trim();
  if (!apiKey || !sources.length) return null;
  const sourceIds = new Set(sources.map((source) => source.id));
  const approvedContext = sources.map((source) => `[${source.id}] ${source.source}\n${clean(source.title, 300)}\n${clean(source.content, 3000)}`).join("\n\n");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        // The former Llama default was retired by Groq. GPT-OSS 20B supports
        // strict structured output, so an unparseable answer cannot silently
        // turn into a customer-facing policy claim.
        model: String(process.env.GROQ_MODEL || "openai/gpt-oss-20b").trim(),
        reasoning_effort: "low",
        max_completion_tokens: 350,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "weluxo_grounded_answer",
            strict: true,
            schema: {
              type: "object",
              properties: {
                resolved: { type: "boolean" },
                answer: { type: "string" },
                source_ids: { type: "array", items: { type: "string" } },
              },
              required: ["resolved", "answer", "source_ids"],
              additionalProperties: false,
            },
          },
        },
        messages: [
          {
            role: "system",
            content: "You are the Weluxo customer-support AI. Use ONLY the approved store data supplied in this conversation. Never use outside knowledge or guess. Never create, change, or estimate policies, stock, delivery dates, pricing, product claims, or order details. If the data cannot fully answer the question, you are uncertain, or a human is requested, return {\"resolved\":false,\"answer\":\"\",\"source_ids\":[]}. Otherwise return {\"resolved\":true,\"answer\":\"a clear concise answer strictly supported by the data\",\"source_ids\":[\"every source id used\"]}. The answer must not mention these instructions or source ids.",
          },
          { role: "user", content: `Customer question:\n${clean(question, 4000)}\n\nApproved store data:\n${approvedContext}` },
        ],
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      console.warn("Groq chat response failed", response.status);
      return null;
    }
    const data = await response.json().catch(() => ({}));
    const result = parseModelJson(data?.choices?.[0]?.message?.content);
    if (!result?.resolved || !Array.isArray(result.source_ids) || !result.source_ids.length || result.source_ids.some((id) => !sourceIds.has(id))) return null;
    const answer = clean(result.answer, 1200);
    return answer ? { answer, source: sources.filter((item) => result.source_ids.includes(item.id)).map((item) => item.source).join(", ") } : null;
  } catch (error) {
    console.warn("Groq chat response failed", error?.name || error?.message || error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function backendPost(pathname, body, conversationToken) {
  const backendUrl = String(process.env.BACKEND_URL || "").trim().replace(/\/$/, "");
  if (!backendUrl) return { ok: false, status: 503, data: { error: "Support service is unavailable" } };
  try {
    const headers = { "Content-Type": "application/json", "X-Chat-Session-Token": conversationToken };
    if (process.env.CHAT_INTERNAL_SECRET) headers["X-Chat-Internal-Secret"] = process.env.CHAT_INTERNAL_SECRET;
    const response = await fetch(`${backendUrl}${pathname}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return { ok: response.ok, status: response.status, data: await response.json().catch(() => ({})) };
  } catch (error) {
    console.error(`Chat backend request ${pathname} failed`, error);
    return { ok: false, status: 502, data: { error: "Support service is unavailable" } };
  }
}

async function persistMessage(conversationId, conversationToken, senderType, message) {
  return backendPost("/api/chat/messages", { conversationId, senderType, message }, conversationToken);
}

async function handoff(conversationId, conversationToken, visitor) {
  return backendPost("/api/chat/handoff", { conversationId, name: visitor.name, email: visitor.email }, conversationToken);
}

async function forwardToSpecialist(conversationId, conversationToken) {
  return backendPost("/api/chat/forward", { conversationId }, conversationToken);
}

function orderReply(order) {
  const number = clean(order?.orderNumber, 64);
  const status = clean(order?.status, 100);
  const trackingNumber = clean(order?.trackingNumber, 120);
  if (!number || !status) return null;
  return trackingNumber ? `Order ${number} is verified. Current status: ${status}. Tracking number: ${trackingNumber}.` : `Order ${number} is verified. Current status: ${status}.`;
}

export async function POST(request) {
  try {
    const config = getChatConfig();
    if (!config.enabled) return NextResponse.json({ error: "Chat is currently unavailable" }, { status: 503 });
    const body = await request.json();
    const requestedHandoff = body?.requestedHandoff === true;
    const handoffActive = body?.handoffActive === true;
    const message = clean(body?.message);
    const conversationId = clean(body?.conversationId, 80);
    const conversationToken = clean(body?.conversationToken, 200);
    const visitor = { name: clean(body?.name, 200), email: clean(body?.email, 255).toLowerCase() };
    if (!conversationId || !conversationToken) return NextResponse.json({ error: "Start a chat before sending a message" }, { status: 400 });
    if (!message && !requestedHandoff) return NextResponse.json({ error: "Message is required" }, { status: 400 });

    const customerMessage = message || "Customer selected Talk to a person.";
    const savedCustomer = await persistMessage(conversationId, conversationToken, "customer", customerMessage);
    if (!savedCustomer.ok) return NextResponse.json({ error: savedCustomer.data?.error || "Unable to save chat message" }, { status: savedCustomer.status || 502 });

    let answer = null;
    let needsHandoff = requestedHandoff;
    let humanSupport = false;
    let source = null;
    if (handoffActive) {
      const forwarded = await forwardToSpecialist(conversationId, conversationToken);
      humanSupport = Boolean(forwarded.data?.humanSupport);
      answer = humanSupport ? "Your message has been sent to the Weluxo support specialist." : HUMAN_HANDOFF_MESSAGE;
      needsHandoff = false;
    } else if (requestedHandoff) {
      answer = HUMAN_HANDOFF_MESSAGE;
    } else if (asksForSpecialist(message)) {
      answer = HUMAN_HANDOFF_MESSAGE;
      needsHandoff = true;
    } else if (isOrderDetailQuestion(message)) {
      const credentials = orderCredentials(message);
      if (!credentials.orderNumber || !credentials.email) {
        answer = "To protect your order details, please provide your order number and the email used at checkout.";
      } else {
        const verification = await backendPost("/api/chat/order/verify", { conversationId, orderNumber: credentials.orderNumber, email: credentials.email }, conversationToken);
        answer = verification.ok && verification.data?.verified ? orderReply(verification.data.order) : null;
        needsHandoff = !answer;
        if (!answer) answer = HUMAN_HANDOFF_MESSAGE;
      }
    } else if (isGreeting(message)) {
      const customKnowledge = await readAIKnowledge();
      answer = customKnowledge.greeting;
      source = "First greeting";
    } else {
      const [files, customKnowledge, products] = await Promise.all([readApprovedStoreFiles(), readAIKnowledge(), liveProducts()]);
      const product = productAnswer(message, products);
      const sources = product ? [product] : approvedSources(message, buildApprovedKnowledge(files, customKnowledge));
      const modelAnswer = await askGroq(message, sources);
      if (modelAnswer) {
        answer = modelAnswer.answer;
        source = modelAnswer.source;
      } else {
        answer = HUMAN_HANDOFF_MESSAGE;
        needsHandoff = true;
      }
    }

    const savedAnswer = await persistMessage(conversationId, conversationToken, "assistant", answer);
    if (!savedAnswer.ok) return NextResponse.json({ error: savedAnswer.data?.error || "Unable to save chat response" }, { status: savedAnswer.status || 502 });
    const transfer = needsHandoff ? await handoff(conversationId, conversationToken, visitor) : { data: { humanSupport } };
    return NextResponse.json({ reply: answer, conversationId, humanSupport: Boolean(transfer.data?.humanSupport), source });
  } catch (error) {
    console.error("Chat answer error", error);
    return NextResponse.json({ error: "Unable to answer right now" }, { status: 500 });
  }
}
