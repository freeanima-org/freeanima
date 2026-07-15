import { basename } from "node:path";
import { isCatastrophicRmTarget } from "./path-policy.ts";

export type TerminalCommandPolicyOpts = {
  argv?: string[] | null;
  workdir?: string | null;
};

/** Quote-aware split of a command line into argv (no shell expansion). */
export function splitCommandLine(command: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: "'" | '"' | null = null;
  let escape = false;

  for (const ch of command) {
    if (escape) {
      cur += ch;
      escape = false;
      continue;
    }
    if (quote === null && ch === "\\") {
      escape = true;
      continue;
    }
    if (quote !== null) {
      if (ch === quote) {
        quote = null;
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (cur.length > 0) {
        out.push(cur);
        cur = "";
      }
      continue;
    }
    cur += ch;
  }
  if (cur.length > 0) out.push(cur);
  return out;
}

function programName(token: string): string {
  return basename(token);
}

function isFlagToken(token: string): boolean {
  return token.startsWith("-") && token !== "-";
}

function hasRecursiveFlag(argv: string[]): boolean {
  for (const t of argv.slice(1)) {
    if (!isFlagToken(t)) continue;
    if (t === "--recursive" || t === "-R" || t === "-r") return true;
    // Combined short flags: -rf, -fr, -Rvf, …
    if (/^-[a-zA-Z]*[rR][a-zA-Z]*$/.test(t)) return true;
  }
  return false;
}

function operandsAfterFlags(argv: string[]): string[] {
  const operands: string[] = [];
  let endFlags = false;
  for (const t of argv.slice(1)) {
    if (!endFlags && t === "--") {
      endFlags = true;
      continue;
    }
    if (!endFlags && isFlagToken(t)) continue;
    operands.push(t);
  }
  return operands;
}

function checkRmStyle(argv: string[], workdir: string): string | null {
  const name = programName(argv[0] ?? "");
  if (name !== "rm" && name !== "rmdir") return null;
  for (const op of operandsAfterFlags(argv)) {
    if (isCatastrophicRmTarget(op, workdir)) {
      return `blocked catastrophic ${name} target: ${op}`;
    }
  }
  return null;
}

function checkChmodChown(argv: string[], workdir: string): string | null {
  const name = programName(argv[0] ?? "");
  if (name !== "chmod" && name !== "chown") return null;
  if (!hasRecursiveFlag(argv)) return null;
  for (const op of operandsAfterFlags(argv)) {
    // chmod mode operand is first non-flag; skip mode-like tokens
    if (/^[0-7]{3,4}$/.test(op) || op.includes(":") || op.includes("+") || op.includes("=")) {
      continue;
    }
    if (isCatastrophicRmTarget(op, workdir)) {
      return `blocked recursive ${name} on catastrophic path: ${op}`;
    }
  }
  return null;
}

function checkFind(argv: string[], workdir: string): string | null {
  const name = programName(argv[0] ?? "");
  if (name !== "find") return null;
  const joined = argv.join(" ");
  const destructive =
    joined.includes("-delete") || /-exec\s+rm\b/.test(joined) || /-exec\s+unlink\b/.test(joined);
  if (!destructive) return null;

  // Leading path args before the first expression flag
  const roots: string[] = [];
  for (const t of argv.slice(1)) {
    if (t.startsWith("-")) break;
    roots.push(t);
  }
  if (roots.length === 0) roots.push(".");

  for (const root of roots) {
    if (isCatastrophicRmTarget(root, workdir)) {
      return `blocked destructive find on catastrophic path: ${root}`;
    }
  }
  return null;
}

function checkDd(argv: string[]): string | null {
  const name = programName(argv[0] ?? "");
  if (name !== "dd") return null;
  for (const t of argv.slice(1)) {
    const m = /^of=(.+)$/i.exec(t);
    if (!m?.[1]) continue;
    const of = m[1];
    if (of === "/dev" || of.startsWith("/dev/")) {
      return `blocked dd write to block/device path: ${of}`;
    }
  }
  return null;
}

function checkForbiddenProgram(argv: string[]): string | null {
  const name = programName(argv[0] ?? "");
  if (name.startsWith("mkfs")) return `blocked filesystem tool: ${name}`;
  if (name === "fdisk" || name === "parted") return `blocked disk tool: ${name}`;
  if (name === "shutdown" || name === "reboot" || name === "halt" || name === "poweroff") {
    return `blocked power command: ${name}`;
  }
  return null;
}

const FORK_BOMB_RE = /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;?\s*:/;

/**
 * Always-on hard safety for terminal_run. Returns deny reason or null.
 * No env escape hatch.
 */
export function assertTerminalCommandAllowed(
  command: string,
  opts: TerminalCommandPolicyOpts = {},
): string | null {
  const workdir = opts.workdir?.trim() || process.cwd();
  const raw = command.trim();
  if (!raw) return "command is empty";

  if (FORK_BOMB_RE.test(raw.replace(/\s/g, ""))) {
    return "blocked fork bomb pattern";
  }

  // Check each shell-ish segment (pipes / ;; / && / ||) so later rm still denies
  const segments = raw
    .split(/(?:&&|\|\||;|\|)/)
    .map((s) => s.trim())
    .filter(Boolean);
  const toCheck =
    opts.argv && opts.argv.length > 0 && segments.length <= 1
      ? [opts.argv]
      : segments.map((seg) => splitCommandLine(seg.replace(/^(?:sudo\s+)+/i, "")));

  for (const argv of toCheck) {
    if (argv.length === 0) continue;
    const clean =
      programName(argv[0] ?? "") === "sudo" ? argv.slice(1).filter((t) => t !== "--") : argv;
    if (clean.length === 0) continue;
    const deny =
      checkForbiddenProgram(clean) ??
      checkRmStyle(clean, workdir) ??
      checkChmodChown(clean, workdir) ??
      checkFind(clean, workdir) ??
      checkDd(clean);
    if (deny) return deny;
  }

  return null;
}
