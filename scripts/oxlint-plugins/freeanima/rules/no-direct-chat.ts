import { relToRepo } from "../lib/repo-path.ts";
import type { RuleModule } from "../lib/types.ts";

const ALLOW_PATH_SUBSTR = [
  "/core/llm/llm.ts",
  "/core/llm/auto-llm-chat.ts",
  "/core/provider/",
  "/capabilities/llm-openai/",
  ".test.ts",
  ".spec.ts",
  "/test-helpers/",
];

function isAllowed(rel: string): boolean {
  const norm = `/${rel.replaceAll("\\", "/")}`;
  return ALLOW_PATH_SUBSTR.some((s) => norm.includes(s) || rel.includes(s.replace(/^\//, "")));
}

function isChatFromLlm(spec: string): boolean {
  if (spec === "./llm.ts" || spec.endsWith("/llm.ts")) return true;
  if (spec === "@freeanima/host/core/llm") return true;
  if (spec.startsWith("@freeanima/host/core/llm/")) return true;
  return false;
}

function identName(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  const n = node as { type?: string; name?: string };
  return n.type === "Identifier" && typeof n.name === "string" ? n.name : null;
}

export const noDirectChat: RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "业务代码禁止直接 import/await chat()；请用 runAutoLlm / loopEngine",
    },
  },
  create(context) {
    const rel = relToRepo(context.filename).replaceAll("\\", "/");
    if (!rel.startsWith("src/")) return {};
    if (isAllowed(rel)) return {};

    return {
      ImportDeclaration(node: unknown) {
        const n = node as {
          source?: { value?: unknown };
          specifiers?: Array<{ type?: string; imported?: unknown; local?: unknown }>;
        };
        const spec = typeof n.source?.value === "string" ? n.source.value : null;
        if (!spec || !isChatFromLlm(spec)) return;
        for (const s of n.specifiers ?? []) {
          if (s.type !== "ImportSpecifier") continue;
          const imported = identName(s.imported);
          const local = identName(s.local);
          if (imported === "chat" || local === "chat") {
            context.report({
              message:
                "禁止直接 import chat；请用 runAutoLlm / runAutoLlmChat，或 conversation turn path (loopEngine)",
              node: s,
            });
          }
        }
      },
      CallExpression(node: unknown) {
        const n = node as { callee?: unknown; parent?: unknown };
        const name = identName(n.callee);
        if (name !== "chat") return;
        // 原脚本要求 await chat(；无 await 的 chat( 也禁止更安全
        context.report({
          message:
            "禁止直接调用 chat()；请用 runAutoLlm / runAutoLlmChat，或 conversation turn path (loopEngine)",
          node,
        });
      },
    };
  },
};
