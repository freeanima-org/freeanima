#!/usr/bin/env bun
/**
 * Gate: business code must not call `chat()` directly.
 * Allowed: llm.ts (definition), auto-llm-chat.ts (recorded side-car exit),
 * provider/backends (Profile.chat), and tests.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");
const SRC = join(ROOT, "src");

const ALLOW_PATH_SUBSTR = [
  "/core/llm/llm.ts",
  "/core/llm/auto-llm-chat.ts",
  "/core/provider/",
  "/capabilities/llm-openai/",
  ".test.ts",
  ".spec.ts",
  "/test-helpers/",
];

const IMPORT_CHAT_RE =
  /(?:import\s*\{[^}]*\bchat\b[^}]*\}\s*from\s*["'](?:\.\/llm\.ts|@freeanima\/host\/core\/llm)["'])|(?:await\s+chat\s*\()/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist" || name === "paraglide") continue;
      walk(p, out);
    } else if (name.endsWith(".ts") || name.endsWith(".tsx")) {
      out.push(p);
    }
  }
  return out;
}

function isAllowed(file: string): boolean {
  const rel = relative(ROOT, file).replaceAll("\\", "/");
  return ALLOW_PATH_SUBSTR.some((s) => rel.includes(s.replace(/^\//, "")) || `/${rel}`.includes(s));
}

const offenders: string[] = [];
for (const file of walk(SRC)) {
  if (isAllowed(file)) continue;
  const text = readFileSync(file, "utf8");
  if (!IMPORT_CHAT_RE.test(text)) continue;
  // Ignore type-only or comments-only false positives: require actual await chat( or import { chat
  if (!/\bchat\b/.test(text)) continue;
  const hasImport =
    /import\s*\{[^}]*\bchat\b[^}]*\}\s*from\s*["'](?:\.\/llm\.ts|@freeanima\/host\/core\/llm(?:\/[^"']*)?)["']/.test(
      text,
    );
  const hasAwait = /await\s+chat\s*\(/.test(text);
  if (hasImport || hasAwait) {
    offenders.push(relative(ROOT, file));
  }
}

if (offenders.length > 0) {
  console.error(
    "Direct chat() usage outside AutoLlm / loop allowlist:\n" +
      offenders.map((f) => `  - ${f}`).join("\n") +
      "\nUse runAutoLlm / runAutoLlmChat, or conversation turn path (loopEngine).",
  );
  process.exit(1);
}

console.log("check-auto-llm-chat-gate: ok");
