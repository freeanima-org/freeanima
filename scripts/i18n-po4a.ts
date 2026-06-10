#!/usr/bin/env bun
/**
 * 统一 po4a 流程：docs + Paraglide UI messages。
 * 1. 生成 po4a.cfg / messages/po4a/en.xml
 * 2. po4a 更新 POT/PO 并写出译文
 * 3. 编译 messages/zh-cn.json（Paraglide 消费）
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

function run(cmd: string, args: string[]): void {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run("bun", ["scripts/gen-po4a-cfg.ts"]);
run("bun", ["scripts/gen-messages-po4a-master.ts"]);
run("po4a", ["po4a.cfg"]);
run("bun", ["scripts/compile-messages-from-po4a.ts"]);

console.log("i18n-po4a: ok");
