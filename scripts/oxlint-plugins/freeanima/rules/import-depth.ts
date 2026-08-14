import { checkImportDepth } from "../lib/import-depth.ts";
import { relToRepo, underScanRoots } from "../lib/repo-path.ts";
import type { RuleModule } from "../lib/types.ts";
import { visitModuleSpecifiers } from "../lib/visit-specifiers.ts";

const SCAN_ROOTS = ["packages", "scripts", "tests"] as const;

export const importDepth: RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "相对 import 最多 ../../；禁止 ../src/",
    },
  },
  create(context) {
    const rel = relToRepo(context.filename);
    if (!underScanRoots(rel, SCAN_ROOTS)) return {};

    return visitModuleSpecifiers(context, (spec, node) => {
      const reason = checkImportDepth(spec);
      if (reason) context.report({ message: `${reason}（${spec}）`, node });
    });
  },
};
