import { relToRepo } from "../lib/repo-path.ts";
import type { RuleModule } from "../lib/types.ts";

/** 与 `scripts/check-module-globals.ts` 同源的模式表（此处内联正则）。 */
const PATTERNS: [string, RegExp][] = [
  ["ensureProcessContext", /\bensureProcessContext\b/],
  ["getProcessContext", /\bgetProcessContext\b/],
  ["resetProcessContextForTests", /\bresetProcessContextForTests\b/],
  ["globalThis-GlobalStore", /globalThis as GlobalStore/],
  [
    "Symbol.for-process-context",
    /Symbol\.for\("@freeanima\/(?:process-context|runtime-context)"\)/,
  ],
  ["Symbol.for-appRuntime", /Symbol\.for\("freeanima\.appRuntime"\)/],
  // 进程根句柄（Cordis 迁移期逃生口，已消除；禁止复活）。
  ["ensureRootContext", /\bensureRootContext\b/],
  ["getRootContextOrNull", /\bgetRootContextOrNull\b/],
  ["getRootContext", /\bgetRootContext\b(?!OrNull)/],
  ["setRootContext", /\bsetRootContext\b/],
  ["resetRootContextForTest", /\bresetRootContextForTest\b/],
];

export const noModuleGlobals: RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "禁止模块级进程上下文/服务定位桥与进程根句柄（ensureProcessContext、globalThis[Symbol.for(...)]、getRootContextOrNull 等）",
    },
  },
  create(context) {
    const rel = relToRepo(context.filename).replaceAll("\\", "/");
    if (!rel.startsWith("packages/")) return {};

    return {
      Program(node: unknown) {
        const text = context.sourceCode.text;
        for (const [name, pattern] of PATTERNS) {
          if (!pattern.test(text)) continue;
          context.report({
            message: `禁止模块级全局桥/进程根句柄（${name}）；请改为显式 ctx / 依赖参数，或由所属模块持有状态`,
            node,
          });
        }
      },
    };
  },
};
