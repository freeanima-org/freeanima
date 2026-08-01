/** Markdown → 朗读用纯文本（轻量规则，不依赖 DOM）。 */

export type SpeechPlaceholders = {
  codeBlock: string;
  table: string;
  /** label = 链接文字或域名摘要 */
  link: (label: string) => string;
  image: string;
};

/** 从 URL 提取可读域名（去 www.，不含 path/query）。 */
export function hostnameFromUrl(url: string): string {
  const trimmed = url.trim();
  try {
    const host = new URL(trimmed).hostname;
    return host.replace(/^www\./i, "") || trimmed;
  } catch {
    const m = trimmed.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i);
    if (m?.[1]) {
      return m[1].replace(/^www\./i, "");
    }
    return trimmed;
  }
}

const TABLE_SEP_RE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/;
const TABLE_ROW_RE = /^\s*\|.*\|\s*$|^\s*[^|\n]+\|[^|\n]+/;

function replaceMarkdownTables(text: string, placeholder: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const next = lines[i + 1] ?? "";
    if (TABLE_ROW_RE.test(line) && i + 1 < lines.length && TABLE_SEP_RE.test(next)) {
      i += 2;
      while (i < lines.length && TABLE_ROW_RE.test(lines[i] ?? "")) {
        i += 1;
      }
      out.push(placeholder);
      continue;
    }
    out.push(line);
    i += 1;
  }
  return out.join("\n");
}

function replaceFencedCodeBlocks(text: string, placeholder: string): string {
  // 闭合围栏
  let out = text.replace(/```[\s\S]*?```/g, placeholder);
  // 未闭合围栏（流式常见）：从剩余起始围栏到文末
  out = out.replace(/```[\s\S]*$/g, placeholder);
  return out;
}

function replaceBareUrls(text: string, link: SpeechPlaceholders["link"]): string {
  // 尖括号 autolink 先处理，避免与裸 URL 重复
  let out = text.replace(/<(https?:\/\/[^>\s]+)>/gi, (_m, url: string) =>
    link(hostnameFromUrl(url)),
  );
  out = out.replace(/https?:\/\/[^\s<>"'`)\]]+/gi, (url) => link(hostnameFromUrl(url)));
  return out;
}

export function markdownToPlainText(markdown: string, placeholders: SpeechPlaceholders): string {
  let text = markdown;
  text = replaceFencedCodeBlocks(text, placeholders.codeBlock);
  text = replaceMarkdownTables(text, placeholders.table);
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, placeholders.image);
  text = text.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (_m, label: string, url: string) => {
    const trimmed = label.trim();
    return placeholders.link(trimmed.length > 0 ? trimmed : hostnameFromUrl(url));
  });
  text = replaceBareUrls(text, placeholders.link);
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");
  text = text.replace(/__([^_]+)__/g, "$1");
  text = text.replace(/_([^_]+)_/g, "$1");
  text = text.replace(/^[-*_]{3,}\s*$/gm, "");
  text = text.replace(/^[\t ]*[-*+]\s+/gm, "");
  text = text.replace(/^[\t ]*\d+\.\s+/gm, "");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/[ \t]+\n/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}
