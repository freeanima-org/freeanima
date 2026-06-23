/** Index text for autobiographical FTS / embedding (title + body). */
export function autobiographicalIndexText(title: string, content: string): string {
  const t = title.trim();
  const c = content.trim();
  if (!t) return c;
  if (!c) return t;
  return `${t}\n${c}`;
}
