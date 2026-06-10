/** recognize common error patterns from stderr tail */

export type StderrDiagnosis = {
  pattern: string;
  hint: string;
};

const PATTERNS: Array<{ re: RegExp; pattern: string; hint: string }> = [
  {
    re: /auth|login|unauthorized|401|403/i,
    pattern: "authentication",
    hint: "Cursor authentication failed; run agent login",
  },
  {
    re: /ENOMEM|out of memory|heap out of memory/i,
    pattern: "memory",
    hint: "Out of memory; reduce task scope or add system memory",
  },
  {
    re: /ENOENT|command not found|not found/i,
    pattern: "missing_binary",
    hint: "Command or dependency not found; check command/args config",
  },
  {
    re: /EACCES|permission denied/i,
    pattern: "permission",
    hint: "Permission denied; check cwd and file permissions",
  },
  {
    re: /rate limit|429|too many requests/i,
    pattern: "rate_limit",
    hint: "API rate limit; retry later",
  },
  {
    re: /network|ECONNREFUSED|ETIMEDOUT|fetch failed/i,
    pattern: "network",
    hint: "Network issue; check proxy and firewall",
  },
];

export function diagnoseStderr(lines: string[]): StderrDiagnosis | null {
  const tail = lines.slice(-10).join(" ");
  if (!tail.trim()) return null;
  for (const { re, pattern, hint } of PATTERNS) {
    if (re.test(tail)) return { pattern, hint };
  }
  return null;
}
