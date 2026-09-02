import sanitizeHtml from "sanitize-html";

export const CMS_HTML_POLICY = {
  allowedTags: [
    "p", "br", "strong", "em", "u", "s", "blockquote", "pre", "code",
    "h2", "h3", "h4", "ul", "ol", "li", "a", "img", "figure", "figcaption",
    "table", "thead", "tbody", "tr", "th", "td", "hr", "span",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"],
    span: ["class"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
  },
};

export function sanitizeCmsHtml(value) {
  return sanitizeHtml(String(value || ""), CMS_HTML_POLICY);
}

export function sanitizeBlogContent(content) {
  if (!content || typeof content !== "object" || Array.isArray(content)) return content;
  return {
    ...content,
    posts: Array.isArray(content.posts)
      ? content.posts.slice(0, 500).map((post) => ({
        ...post,
        body: sanitizeCmsHtml(post?.body || ""),
      }))
      : [],
  };
}
