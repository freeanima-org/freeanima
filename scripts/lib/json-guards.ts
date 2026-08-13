/** smoke / archive 脚本用：JSON.parse 结果窄化 */

export type DocsListResult = {
  total: number;
  docs: { path: string }[];
};

export type DocsGetResult = {
  content: string;
};

export type DocsSearchResult = {
  total: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export function parseDocsListResult(raw: unknown): DocsListResult {
  if (!isRecord(raw)) throw new Error("docs list: expected object");
  const { total, docs } = raw;
  if (typeof total !== "number" || !Array.isArray(docs)) {
    throw new Error("docs list: invalid shape");
  }
  const parsedDocs = docs.map((entry, i) => {
    if (!isRecord(entry) || typeof entry.path !== "string") {
      throw new Error(`docs list: docs[${i}].path invalid`);
    }
    return { path: entry.path };
  });
  return { total, docs: parsedDocs };
}

export function parseDocsGetResult(raw: unknown): DocsGetResult {
  if (!isRecord(raw) || typeof raw.content !== "string") {
    throw new Error("docs get: invalid shape");
  }
  return { content: raw.content };
}

export function parseDocsSearchResult(raw: unknown): DocsSearchResult {
  if (!isRecord(raw) || typeof raw.total !== "number") {
    throw new Error("docs search: invalid shape");
  }
  return { total: raw.total };
}

export function parseJsonUnknown(text: string): unknown {
  const parsed: unknown = JSON.parse(text);
  return parsed;
}
