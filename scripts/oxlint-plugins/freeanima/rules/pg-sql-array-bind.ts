import { findPgSqlArrayHitsInTemplateBody } from "../lib/pg-sql-array.ts";
import { relToRepo } from "../lib/repo-path.ts";
import type { RuleModule } from "../lib/types.ts";

function tagName(tag: unknown): string | null {
  if (!tag || typeof tag !== "object") return null;
  const t = tag as { type?: string; name?: string; property?: unknown };
  if (t.type === "Identifier" && typeof t.name === "string") return t.name;
  // sql.raw / rare — ignore
  if (t.type === "MemberExpression") {
    const prop = t.property as { type?: string; name?: string } | undefined;
    if (prop?.type === "Identifier" && typeof prop.name === "string") return prop.name;
  }
  return null;
}

export const pgSqlArrayBind: RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Bun SQL：勿将 JS string[] 直接绑给 ANY / ?| / ?& / &&；改用 pgTextArray 或 ARRAY[…]::text[]",
    },
  },
  create(context) {
    const rel = relToRepo(context.filename).replaceAll("\\", "/");
    if (!rel.startsWith("src/host/core/db/pg/")) return {};

    return {
      TaggedTemplateExpression(node: unknown) {
        const n = node as { tag?: unknown; quasi?: unknown };
        const name = tagName(n.tag);
        if (name !== "sql" && name !== "drizzleSql") return;
        const quasiText = context.sourceCode.getText(n.quasi);
        // TemplateLiteral getText 含外层反引号
        if (quasiText.length < 2 || quasiText[0] !== "`" || quasiText.at(-1) !== "`") return;
        const body = quasiText.slice(1, -1);
        for (const hit of findPgSqlArrayHitsInTemplateBody(body)) {
          context.report({
            message: `勿将 JS 数组直接绑给 ANY/?|/&&：\${${hit.expr}}；改用 pgTextArray(...) 或 ARRAY[\${v},…]::text[]`,
            node,
          });
        }
      },
    };
  },
};
