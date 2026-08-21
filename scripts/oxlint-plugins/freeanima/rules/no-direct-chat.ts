import { relToRepo } from "../lib/repo-path.ts";
import { isRecord } from "../lib/is-record.ts";
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
  if (spec === "@freeanima/habitat/core/llm") return true;
  if (spec.startsWith("@freeanima/habitat/core/llm/")) return true;
  return false;
}

function identName(node: unknown): string | null {
  if (!isRecord(node)) return null;
  return node.type === "Identifier" && typeof node.name === "string" ? node.name : null;
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
    if (!rel.startsWith("packages/")) return {};
    if (isAllowed(rel)) return {};

    return {
      ImportDeclaration(node: unknown) {
        if (!isRecord(node)) return;
        const source = node.source;
        const spec = isRecord(source) && typeof source.value === "string" ? source.value : null;
        if (!spec || !isChatFromLlm(spec)) return;
        const specifiers = Array.isArray(node.specifiers) ? node.specifiers : [];
        for (const s of specifiers) {
          if (!isRecord(s) || s.type !== "ImportSpecifier") continue;
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
        if (!isRecord(node)) return;
        const name = identName(node.callee);
        if (name !== "chat") return;
        context.report({
          message:
            "禁止直接调用 chat()；请用 runAutoLlm / runAutoLlmChat，或 conversation turn path (loopEngine)",
          node,
        });
      },
    };
  },
};
