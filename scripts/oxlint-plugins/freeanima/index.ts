/**
 * FreeAnima 仓库自定义 oxlint 护栏（jsPlugins）。
 * 规则名：`freeanima/<rule>`。
 * `dir:` 存在性由外部包 `bun-plugin-dir-import/oxlint` 提供。
 */
import { importDepth } from "./rules/import-depth.ts";
import { layerDeps } from "./rules/layer-deps.ts";
import { noDirectChat } from "./rules/no-direct-chat.ts";
import { noDirectOfflineCache } from "./rules/no-direct-offline-cache.ts";
import { noModuleGlobals } from "./rules/no-module-globals.ts";
import { pgSqlArrayBind } from "./rules/pg-sql-array-bind.ts";

const plugin = {
  meta: {
    name: "freeanima",
  },
  rules: {
    "import-depth": importDepth,
    "layer-deps": layerDeps,
    "no-direct-offline-cache": noDirectOfflineCache,
    "no-direct-chat": noDirectChat,
    "no-module-globals": noModuleGlobals,
    "pg-sql-array-bind": pgSqlArrayBind,
  },
};

export default plugin;
