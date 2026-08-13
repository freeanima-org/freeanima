const MAX_PARENT_DEPTH = 2;
const RESOURCE_EXT = /\.(json|md|sql|wasm|txt)$/i;

function parentDepth(spec: string): number {
  if (!spec.startsWith(".")) return 0;
  const match = /^(\.\.\/)+/.exec(spec);
  if (!match) return 0;
  return match[0].length / 3;
}

/** 相对 import 深度 / ../src/ 护栏；合法返回 null。 */
export function checkImportDepth(spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  if (RESOURCE_EXT.test(spec)) return null;
  const depth = parentDepth(spec);
  if (depth > MAX_PARENT_DEPTH) {
    return `相对 import 超过 ${MAX_PARENT_DEPTH} 级父目录（${"../".repeat(depth)}）；请改用 @freeanima/*`;
  }
  if (/(?:\.\.\/)+src\//.test(spec)) {
    return "禁止相对路径 `../src/`；请改用 @freeanima/*";
  }
  return null;
}
