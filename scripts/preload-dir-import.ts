/**
 * 源码 / bun test 预加载：注册 `dir:` namespace，供
 * `src/host/core/db/migrations-dir-import.ts` 等调用点解析。
 */
import { plugin } from "bun";

import { createDirImportPlugin } from "./dir-import-plugin.ts";

void plugin(createDirImportPlugin());
