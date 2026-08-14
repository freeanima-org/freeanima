import { relToRepo } from "../lib/repo-path.ts";
import type { RuleModule } from "../lib/types.ts";

const ALLOW_FILE =
  /(^|\/)(offline-cache|offline-store|offline-.*adapter|pomodoro-offline-adapter)\.tsx?$/;

const FORBIDDEN = new Set(["readOfflineCache", "writeOfflineCache"]);

function identName(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  const n = node as { type?: string; name?: string };
  return n.type === "Identifier" && typeof n.name === "string" ? n.name : null;
}

export const noDirectOfflineCache: RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "feature UI 禁止直接 readOfflineCache/writeOfflineCache；经 withOfflineCache 或 offline-cache 薄封装",
    },
  },
  create(context) {
    const rel = relToRepo(context.filename).replaceAll("\\", "/");
    if (!rel.startsWith("packages/frontend/features/") || !rel.includes("/ui/")) return {};
    if (rel.includes(".test.") || rel.includes(".spec.")) return {};
    if (ALLOW_FILE.test(rel)) return {};

    const reportName = (name: string, node: unknown) => {
      context.report({
        message: `feature UI 禁止直接 ${name}；请改用 withOfflineCache，或放到 offline-cache 薄封装`,
        node,
      });
    };

    return {
      ImportSpecifier(node: unknown) {
        const n = node as { imported?: unknown; local?: unknown };
        const imported = identName(n.imported);
        if (imported && FORBIDDEN.has(imported)) {
          reportName(imported, node);
          return;
        }
        const local = identName(n.local);
        if (local && FORBIDDEN.has(local) && local !== imported) {
          reportName(local, node);
        }
      },
      CallExpression(node: unknown) {
        const n = node as { callee?: unknown };
        const name = identName(n.callee);
        if (name && FORBIDDEN.has(name)) reportName(name, node);
      },
    };
  },
};
