/** 与 domain `looksLikeHtmlContent` 对齐的 UI 侧粗判（避免卫星层直引 domain）。 */
export function looksLikeHtmlBody(source: string): boolean {
  const s = source.trimStart();
  if (!s) return false;
  if (/^<!DOCTYPE\s+html\b/i.test(s) || /^<html[\s>]/i.test(s)) return true;
  if (/^<(?:div|table|center|body|span|p|style|section|article|main)\b/i.test(s)) return true;
  const tags = s.slice(0, 4000).match(/<\/?[a-z][a-z0-9]*\b/gi);
  return (tags?.length ?? 0) >= 3;
}

const EMAIL_HTML_CSP =
  "default-src 'none'; img-src https: http: data: cid:; style-src 'unsafe-inline'; font-src https: data:; media-src https: http:;";

const EMAIL_HTML_BASE_STYLE =
  "html,body{background:#fff;color:#111;margin:0;}body{padding:12px;font-family:sans-serif;}";

/** 为 sandbox iframe 组装 srcDoc：补 charset/CSP/白底，片段包一层 document。 */
export function buildEmailHtmlSrcDoc(html: string): string {
  const trimmed = html.trim();
  const headBits = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${EMAIL_HTML_CSP}"><base target="_blank" rel="noopener noreferrer"><style>${EMAIL_HTML_BASE_STYLE}</style>`;
  if (/^<!DOCTYPE\s+html\b/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    if (/<head[\s>]/i.test(trimmed)) {
      return trimmed.replace(/<head([^>]*)>/i, `<head$1>${headBits}`);
    }
    return trimmed.replace(/<html([^>]*)>/i, `<html$1><head>${headBits}</head>`);
  }
  return `<!DOCTYPE html><html><head>${headBits}</head><body>${trimmed}</body></html>`;
}
