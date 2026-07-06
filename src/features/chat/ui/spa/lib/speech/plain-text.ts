/** Markdown → 朗读用纯文本（轻量规则，不依赖 DOM）。 */
export function markdownToPlainText(markdown: string): string {
  let text = markdown;
  text = text.replace(/```[\s\S]*?```/g, " ");
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
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
