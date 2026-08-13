import { checkLayerDeps } from "../lib/layer-deps.ts";
import { relToRepo } from "../lib/repo-path.ts";
import type { RuleModule } from "../lib/types.ts";
import { visitModuleSpecifiers } from "../lib/visit-specifiers.ts";

export const layerDeps: RuleModule = {
  meta: {
    type: "problem",
    docs: { description: "仓库层依赖矩阵（host/client/ui-kit/features）" },
  },
  create(context) {
    const rel = relToRepo(context.filename).replaceAll("\\", "/");
    if (!rel.startsWith("src/")) return {};
    if (rel.includes(".test.") || rel.includes(".spec.")) return {};

    return visitModuleSpecifiers(context, (spec, node) => {
      const reason = checkLayerDeps(rel, spec);
      if (reason) context.report({ message: `${reason}（${spec}）`, node });
    });
  },
};
