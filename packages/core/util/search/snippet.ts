export type TextSearchSnippetOpts = {
  maxLen?: number;
  contextChars?: number;
};

/** Extract matchable terms from query (strip AND/OR/NOT and quoted phrases) */
export function extractSearchTerms(query: string): string[] {
  const q = query.trim();
  if (!q) return [];

  const terms: string[] = [];
  const quoted = [...q.matchAll(/"([^"]+)"/g)];
  for (const m of quoted) {
    const t = m[1]?.trim();
    if (t) terms.push(t);
  }

  const withoutQuotes = q.replace(/"[^"]*"/g, " ");
  const withoutOps = withoutQuotes.replace(/\b(AND|OR|NOT)\b/gi, " ");
  for (const part of withoutOps.split(/\s+/)) {
    const t = part.trim();
    if (t) terms.push(t);
  }

  return terms;
}

/** Extract short snippet around query terms in content (fallback for trgm/vector non-headline hits) */
export function buildTextSearchSnippet(
  query: string,
  content: string,
  opts?: TextSearchSnippetOpts,
): string {
  const maxLen = opts?.maxLen ?? 200;
  const contextChars = opts?.contextChars ?? 60;
  const trimmed = content.trim();
  if (!trimmed) return "";

  const terms = extractSearchTerms(query);
  if (terms.length === 0) {
    return trimmed.length <= maxLen ? trimmed : `${trimmed.slice(0, maxLen)}…`;
  }

  const lowerContent = trimmed.toLowerCase();
  let matchIndex = -1;
  let matchedTerm = "";
  for (const term of terms) {
    const idx = lowerContent.indexOf(term.toLowerCase());
    if (idx !== -1) {
      matchIndex = idx;
      matchedTerm = term;
      break;
    }
  }

  if (matchIndex === -1) {
    return trimmed.length <= maxLen ? trimmed : `${trimmed.slice(0, maxLen)}…`;
  }

  const start = Math.max(0, matchIndex - contextChars);
  const end = Math.min(trimmed.length, matchIndex + matchedTerm.length + contextChars);
  let snippet = trimmed.slice(start, end);
  if (start > 0) snippet = `…${snippet}`;
  if (end < trimmed.length) snippet = `${snippet}…`;

  if (snippet.length > maxLen) {
    return `${snippet.slice(0, maxLen)}…`;
  }
  return snippet;
}

export type StoredMessageSearchFields = {
  conversation_id: string;
  message_id: string;
  role: string;
  timestamp: string;
  content: string;
  rank: number;
};

export type StoredMessageSearchHit = {
  conversation_id: string;
  message_id: string;
  role: string;
  timestamp: string;
  snippet: string;
  rank: number;
};

/** Conversation message FTS hit → external search hit (snippet, no full content) */
export function formatStoredMessageSearchHit(
  query: string,
  row: StoredMessageSearchFields,
): StoredMessageSearchHit {
  return {
    conversation_id: row.conversation_id,
    message_id: row.message_id,
    role: row.role,
    timestamp: row.timestamp,
    rank: row.rank,
    snippet: buildTextSearchSnippet(query, row.content),
  };
}
