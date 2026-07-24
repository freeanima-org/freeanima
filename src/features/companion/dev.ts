#!/usr/bin/env bun
/**
 * 伴侣本地 dev：HTTP + Vite middlewareMode 单端口 HMR（无法用 `vite` CLI 替代）。
 * 产品 Portal/Tauri 走壳内伴侣浮层（embedded-overlay），不依赖此进程。
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { startCompanionServer } from "./server/index.ts";

process.env.COMPANION_PACKAGE_ROOT ??= join(dirname(fileURLToPath(import.meta.url)));

await startCompanionServer({ viteDev: true });
