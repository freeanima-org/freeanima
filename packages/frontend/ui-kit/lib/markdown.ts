import { sanitize } from "isomorphic-dompurify";
import { marked } from "marked";

export type AnimaUriLabelMap = ReadonlyMap<number, string>;

function labelForId(labels: AnimaUriLabelMap | undefined, id: number): string | undefined {
  if (!labels) return undefined;
  const v = labels.get(id);
  return v?.trim() ? v.trim() : undefined;
}

/** `[[anima:id]]` / `[[anima:id?component=…]]` → clickable chips for openEntityResource */
function rewriteAnimaUriMarkers(html: string, labels?: AnimaUriLabelMap): string {
  return html.replace(
    /\[\[anima:(\d+)((?:\?[^\]]*)?)\]\]/gi,
    (_full, idRaw: string, query: string) => {
      const id = Number(idRaw);
      const href = `anima:${idRaw}${query ?? ""}`;
      const snippet = Number.isInteger(id) ? labelForId(labels, id) : undefined;
      const text = snippet ? `#${idRaw} ${escapeHtml(snippet)}` : `#${idRaw}`;
      return `<a href="${href}" data-anima-uri="${href}" class="anima-uri-chip">${text}</a>`;
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
 *
 * `labels`：可选实体摘要（最多 10 字已由调用方截好）；缺省时 chip 仅显示 `#id`。
 */
export function renderMarkdownHtml(text: string, labels?: AnimaUriLabelMap): string {
  if (!text) return "";
  let html: string;
  try {
    html = marked.parse(text, { breaks: true, gfm: true }) as string;
  } catch {
    html = escapeHtml(text);
  }
  html = rewriteAnimaUriMarkers(html, labels);
  return sanitize(html, {
    ADD_ATTR: ["data-anima-uri"],
    // 保留 anima: 深链；点击由 data-anima-uri + 委托处理
    ALLOWED_URI_REGEXP:
      /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|anima):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i,
  });
}
