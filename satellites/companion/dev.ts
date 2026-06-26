#!/usr/bin/env bun
/**
 * 伴侣 dev：sidecar HTTP + Vite middlewareMode 单端口 HMR（无法用 `vite` CLI 替代）。
 */
import { startCompanionServer } from "./server/index.ts";

await startCompanionServer({ viteDev: true });
