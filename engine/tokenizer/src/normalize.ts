/** Ollama tag suffix: qwen2.5:7b → qwen2.5 */
export function stripOllamaTag(model: string): string {
  const trimmed = model.trim();
  const colon = trimmed.indexOf(":");
  if (colon <= 0) return trimmed;
  return trimmed.slice(0, colon);
}

const SEARCH_SUFFIX_RE = /-(chat|instruct|flash|base|latest)$/i;

/** Search query variants for HF Hub model search. */
export function buildSearchQueries(model: string): string[] {
  const trimmed = model.trim();
  if (!trimmed || trimmed.includes("/")) return [];

  const seen = new Set<string>();
  const add = (q: string | undefined | null): void => {
    const s = q?.trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
  };

  const base = stripOllamaTag(trimmed);
  add(trimmed);
  add(base);
  add(base.replace(/_/g, "-"));
  add(base.replace(/-/g, "_"));

  const noSuffix = base.replace(SEARCH_SUFFIX_RE, "");
  if (noSuffix !== base) add(noSuffix);

  return [...seen];
}

/** kebab segments → Title-Kebab (deepseek-v4-flash → Deepseek-V4-Flash). */
export function toTitleKebabModel(model: string): string {
  return model
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((part) => {
      if (/^v\d+$/i.test(part)) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("-");
}
