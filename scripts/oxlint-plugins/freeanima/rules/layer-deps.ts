import { checkLayerDeps } from "../lib/layer-deps.ts";
import { LAYER_DEPS_BASELINE } from "../lib/layer-deps-baseline.ts";
import { relToRepo } from "../lib/repo-path.ts";
import type { RuleModule } from "../lib/types.ts";
import { visitModuleSpecifiers } from "../lib/visit-specifiers.ts";

/** 该文件是否在基线中放行（`<from> -> <to>` 命中其一即可）。 */
function baselined(rel: string): boolean {
  for (const entries of Object.values(LAYER_DEPS_BASELINE)) {
    if (entries.includes(rel)) return true;
  }
  return false;
}

export const layerDeps: RuleModule = {
  meta: {
    type: "problem",
    docs: { description: "仓库层依赖矩阵（13 包 DAG，含相对路径）" },
  },
  create(context) {
    const rel = relToRepo(context.filename).replaceAll("\\", "/");
    if (!rel.startsWith("packages/")) return {};
    if (rel.includes(".test.") || rel.includes(".spec.")) return {};
    if (baselined(rel)) return {};

    return visitModuleSpecifiers(context, (spec, node) => {
      const reason = checkLayerDeps(rel, spec);
      if (reason) context.report({ message: `${reason}（${spec}）`, node });
    });
  },
};
