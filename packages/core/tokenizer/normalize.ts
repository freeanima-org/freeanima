/** Ollama tag suffix: qwen2.5:7b → qwen2.5 */
export function stripOllamaTag(model: string): string {
  const trimmed = model.trim();
  const colon = trimmed.indexOf(":");
  if (colon <= 0) return trimmed;
  return trimmed.slice(0, colon);
}

const SEARCH_SUFFIX_RE = /-(chat|instruct|flash|base|latest)$/i;

/** Ollama/GGUF 量化与变体后缀（逐段剥离以回落 base model）。 */
const VARIANT_SUFFIX_RE =
  /-(?:\d+t|fp16|f16|bf16|q\d+(?:_[A-Za-z0-9]+)?|latest|chat|instruct|flash|base)$/i;

/** 从量化/变体名逐段剥离，生成 base model 候选（含原名）。 */
export function deriveBaseModelNames(model: string): string[] {
  const trimmed = model.trim();
  if (!trimmed || trimmed.includes("/")) return trimmed ? [trimmed] : [];

  const seen = new Set<string>();
  const names: string[] = [];
  const add = (name: string): void => {
    const n = name.trim();
    if (!n || seen.has(n)) return;
    seen.add(n);
    names.push(n);
  };

  const base = stripOllamaTag(trimmed);
  add(base);

  let current = base;
  while (true) {
    const next = current.replace(VARIANT_SUFFIX_RE, "");
    if (next === current || !next) break;
    add(next);
    current = next;
  }

  return names;
}

/** Search query variants for HF Habitat model search. */
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

  for (const derived of deriveBaseModelNames(trimmed)) {
    if (derived !== base) add(derived);
  }

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
