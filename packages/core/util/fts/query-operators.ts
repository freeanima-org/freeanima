export const FTS_QUERY_OPERATORS = ["AND", "OR", "NOT"] as const;
export type FtsQueryOperator = (typeof FTS_QUERY_OPERATORS)[number];
export type FtsQueryOperatorSymbol = "&" | "|" | "!";

export type FtsOperatorSegment =
  | { type: "operands"; tokens: string[] }
  | { type: "op"; op: FtsQueryOperatorSymbol };

const OPERATOR_SET = new Set<string>(FTS_QUERY_OPERATORS);

export function hasFtsQueryOperators(trimmed: string): boolean {
  return FTS_QUERY_OPERATORS.some((op) => trimmed.includes(` ${op} `));
}

/** Tokenize query respecting double-quoted phrases. */
export function tokenizeFtsQuery(text: string): string[] {
  const tokens: string[] = [];
  const s = text.trim();
  let i = 0;

  while (i < s.length) {
    while (i < s.length) {
      const ws = s[i];
      if (ws === undefined || !/\s/.test(ws)) break;
      i += 1;
    }
    if (i >= s.length) break;

    const ch = s[i];
    if (ch === undefined) break;

    if (ch === '"') {
      i += 1;
      let quoted = '"';
      while (i < s.length) {
        const inner = s[i];
        if (inner === undefined || inner === '"') break;
        quoted += inner;
        i += 1;
      }
      if (i < s.length) {
        quoted += '"';
        i += 1;
      }
      tokens.push(quoted);
      continue;
    }

    let plain = "";
    while (i < s.length) {
      const plainCh = s[i];
      if (plainCh === undefined || /\s/.test(plainCh)) break;
      plain += plainCh;
      i += 1;
    }
    if (plain) tokens.push(plain);
  }

  return tokens;
}

export function operatorTokenToSymbol(token: string): FtsQueryOperatorSymbol | null {
  const upper = token.toUpperCase();
  if (upper === "AND") return "&";
  if (upper === "OR") return "|";
  if (upper === "NOT") return "!";
  return null;
}

export function isFtsOperatorToken(token: string): boolean {
  return OPERATOR_SET.has(token.toUpperCase());
}

/** Split query into operand groups (space = AND within group) and boolean operators. */
export function parseFtsOperatorQuery(text: string): FtsOperatorSegment[] {
  const tokens = tokenizeFtsQuery(text);
  const segments: FtsOperatorSegment[] = [];
  let pending: string[] = [];

  const flushOperands = (): void => {
    if (pending.length === 0) return;
    segments.push({ type: "operands", tokens: pending });
    pending = [];
  };

  for (const tok of tokens) {
    const op = operatorTokenToSymbol(tok);
    if (op) {
      flushOperands();
      segments.push({ type: "op", op });
    } else {
      pending.push(tok);
    }
  }
  flushOperands();
  return segments;
}

export function flushOperandGroup(parts: string[]): string {
  const filtered = parts.filter(Boolean);
  if (filtered.length === 0) return "";
  if (filtered.length === 1) {
    const sole = filtered[0];
    return sole ?? "";
  }
  return filtered.join(" & ");
}

export function buildOperatorTsQuery(
  segments: FtsOperatorSegment[],
  operandToPart: (tok: string) => string,
): string {
  const output: string[] = [];

  for (const seg of segments) {
    if (seg.type === "op") {
      output.push(seg.op);
      continue;
    }
    const parts = seg.tokens
      .map((tok) => operandToPart(tok))
      .filter(Boolean)
      .map((part) => wrapTsqueryPart(part));
    const group = flushOperandGroup(parts);
    if (group) output.push(group);
  }

  return output.join(" ");
}

function wrapTsqueryPart(part: string): string {
  if (!part) return part;
  if (part.includes(" & ") || part.includes(" | ") || part.includes(" <-> ")) {
    return `(${part})`;
  }
  return part;
}
