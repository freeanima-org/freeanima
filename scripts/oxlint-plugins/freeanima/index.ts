/**
 * FreeAnima 仓库自定义 oxlint 护栏（jsPlugins）。
 * 规则名：`freeanima/<rule>`。
 */
import { dirImportExists } from "./rules/dir-import-exists.ts";
import { importDepth } from "./rules/import-depth.ts";
import { layerDeps } from "./rules/layer-deps.ts";
import { noDirectChat } from "./rules/no-direct-chat.ts";
import { noDirectOfflineCache } from "./rules/no-direct-offline-cache.ts";
import { pgSqlArrayBind } from "./rules/pg-sql-array-bind.ts";

const plugin = {
  meta: {
    name: "freeanima",
  },
  rules: {
    "dir-import-exists": dirImportExists,
    "import-depth": importDepth,
    "layer-deps": layerDeps,
    "no-direct-offline-cache": noDirectOfflineCache,
    "no-direct-chat": noDirectChat,
    "pg-sql-array-bind": pgSqlArrayBind,
  },
};

export default plugin;
