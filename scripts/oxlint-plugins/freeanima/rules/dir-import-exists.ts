import { checkDirImport } from "../lib/dir-import.ts";
import type { RuleModule } from "../lib/types.ts";
import { visitModuleSpecifiers } from "../lib/visit-specifiers.ts";

export const dirImportExists: RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "Bun `dir:` import 必须解析到存在的目录（web dist 构建产物可缺）",
    },
  },
  create(context) {
    return visitModuleSpecifiers(context, (spec, node) => {
      const msg = checkDirImport(context.filename, spec);
      if (msg) context.report({ message: msg, node });
    });
  },
};
