const TOKEN_PATTERN = /\{(\w+)\}/g;

const ALLOWED_TAGS = new Set([
  "br",
  "div",
  "em",
  "li",
  "ol",
  "p",
  "strong",
  "u",
  "ul",
]);

const TAG_ALIASES: Record<string, string> = {
  b: "strong",
  i: "em",
};

export function renderTemplateText(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(TOKEN_PATTERN, (_match, key: string) => {
    return values[key] ?? `{${key}}`;
  });
}

export function findUnknownTemplatePlaceholders(
  template: string,
  allowedKeys: readonly string[],
): string[] {
  const allowed = new Set(allowedKeys);
  return [
    ...new Set(
      Array.from(template.matchAll(TOKEN_PATTERN), (match) => match[1]).filter(
        (key) => !allowed.has(key),
      ),
    ),
  ];
}

export function renderRichTextTemplateBody(
  template: string,
  values: Record<string, string>,
): { text: string; html: string } {
  if (looksLikeHtml(template)) {
    const renderedHtml = template.replace(TOKEN_PATTERN, (_match, key: string) => {
      return escapeHtml(values[key] ?? `{${key}}`);
    });
    const html = sanitizeRichTextHtml(renderedHtml);
    return { html, text: htmlToText(html) };
  }

  const text = renderTemplateText(template, values);
  return { text, html: textToHtml(text) };
}

export function sanitizeRichTextHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(
      /<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      "",
    )
    .replace(/<\/?([a-zA-Z][\w:-]*)(?:\s[^>]*)?>/g, (tag, rawName: string) => {
      const isClosing = /^<\s*\//.test(tag);
      const name = TAG_ALIASES[rawName.toLowerCase()] ?? rawName.toLowerCase();
      if (!ALLOWED_TAGS.has(name)) return "";
      if (name === "br") return "<br>";
      return isClosing ? `</${name}>` : `<${name}>`;
    });
}

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-zA-Z][^>]*>/.test(value);
}

function textToHtml(text: string): string {
  return `<p>${escapeHtml(text).replace(/\r?\n/g, "<br>")}</p>`;
}

function htmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li>/gi, "- ")
      .replace(/<\/(div|p|li)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}
