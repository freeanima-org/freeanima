#!/usr/bin/env bun
/**
 * 浏览器开发壳：watch 构建 shell-ui 并在本地静态托管。
 * 用法：anima service start --foreground & bun run dev:web
 */
import { buildAppWeb } from "./build.ts";

await buildAppWeb({ watch: true, minify: false, sourcemap: true });
await import("./server.ts");
