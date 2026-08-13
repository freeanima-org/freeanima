import type { RuleContext } from "./types.ts";

type SourceHolder = {
  type?: string;
  source?: { type?: string; value?: unknown } | null;
};

/** 从 Import/Export/动态 import 节点取出字符串 specifier。 */
export function getModuleSpecifier(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  const n = node as SourceHolder;
  const src = n.source;
  if (!src || typeof src !== "object") return null;
  if (typeof src.value === "string") return src.value;
  return null;
}

type Visitor = Record<string, (node: unknown) => void>;

/** 对静态/动态 import、export-from 的字符串 specifier 调用 check。 */
export function visitModuleSpecifiers(
  _context: RuleContext,
  check: (spec: string, node: unknown) => void,
): Visitor {
  const onDecl = (node: unknown) => {
    const spec = getModuleSpecifier(node);
    if (spec) check(spec, node);
  };
  const onImportExpr = (node: unknown) => {
    const n = node as SourceHolder;
    const src = n.source;
    if (src && typeof src.value === "string") check(src.value, node);
  };
  return {
    ImportDeclaration: onDecl,
    ExportNamedDeclaration: onDecl,
    ExportAllDeclaration: onDecl,
    ImportExpression: onImportExpr,
  };
}
