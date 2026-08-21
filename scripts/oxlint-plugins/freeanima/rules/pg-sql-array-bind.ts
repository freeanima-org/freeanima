import { findPgSqlArrayHitsInTemplateBody } from "../lib/pg-sql-array.ts";
import { isRecord } from "../lib/is-record.ts";
import { relToRepo } from "../lib/repo-path.ts";
import type { RuleModule } from "../lib/types.ts";

function tagName(tag: unknown): string | null {
  if (!isRecord(tag)) return null;
  if (tag.type === "Identifier" && typeof tag.name === "string") return tag.name;
  if (tag.type === "MemberExpression") {
    const prop = tag.property;
    if (isRecord(prop) && prop.type === "Identifier" && typeof prop.name === "string") {
      return prop.name;
    }
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
    if (!rel.startsWith("packages/habitat/core/db/pg/")) return {};

    return {
      TaggedTemplateExpression(node: unknown) {
        if (!isRecord(node)) return;
        const name = tagName(node.tag);
        if (name !== "sql" && name !== "drizzleSql") return;
        const quasiText = context.sourceCode.getText(node.quasi);
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
