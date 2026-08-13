/**
 * 源码 / bun test 预加载：注册 `dir:` namespace，供
 * migrations-dir-import / docs-dir-import 等调用点解析。
 */
import { plugin } from "bun";

import { createDirImportPlugin } from "./dir-import-plugin.ts";

void plugin(createDirImportPlugin());
