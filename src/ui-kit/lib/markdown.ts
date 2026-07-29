import { sanitize } from "isomorphic-dompurify";
import { marked } from "marked";

/** `[[anima:id]]` / `[[anima:id?component=…]]` → clickable anchors for openEntityResource */
function rewriteAnimaUriMarkers(html: string): string {
  return html.replace(
    /\[\[anima:(\d+)((?:\?[^\]]*)?)\]\]/gi,
    (_full, id: string, query: string) => {
      const href = `anima:${id}${query ?? ""}`;
      return `<a href="${href}" data-anima-uri="${href}" class="link link-hover font-mono text-xs">[[anima:${id}${query ?? ""}]]</a>`;
    },
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Markdown → 消毒后的 HTML（聊天 / Habitat 会话等 UI 共用）。
 * 失败时回退为转义纯文本。
 */
export function renderMarkdownHtml(text: string): string {
  if (!text) return "";
  let html: string;
  try {
    html = marked.parse(text, { breaks: true, gfm: true }) as string;
  } catch {
    html = escapeHtml(text);
  }
  html = rewriteAnimaUriMarkers(html);
  return sanitize(html, {
    ADD_ATTR: ["data-anima-uri"],
  });
}
