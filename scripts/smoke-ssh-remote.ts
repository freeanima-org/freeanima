#!/usr/bin/env bun
/**
 * SSH Remote 冒烟（无真实远端时的自动化门闩 + 手测清单打印）。
 *
 * 用法：
 *   just pack client-probe && bun scripts/smoke-ssh-remote.ts
 */
import { $ } from "bun";
import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  isLoopbackHabitatUrl,
  mappedLoopbackHabitatUrl,
  parseSshRemoteTarget,
  resolveLocalProbeBinary,
} from "../packages/shared/coding/ssh-remote/index.ts";

const ROOT = join(import.meta.dir, "..");
const DIST_PROBE = join(ROOT, "dist/outpost-clis/anima-probe");
const DIST_CLIENT = join(ROOT, "dist/outpost-clis/anima-client");

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  console.log("[smoke-ssh] resolveLocalProbeBinary…");
  const probe = resolveLocalProbeBinary();
  assert(probe, "找不到 anima-probe；请先 just pack client-probe");
  console.log(`[smoke-ssh] probe=${probe}`);

  assert(existsSync(DIST_PROBE), `缺少 ${DIST_PROBE}`);
  assert(existsSync(DIST_CLIENT), `缺少 ${DIST_CLIENT}`);

  const target = parseSshRemoteTarget({
    ssh: "alice@dev.example",
    remoteWorkspace: "/home/alice/repo",
  });
  assert(target.user === "alice" && target.host === "dev.example", "parse target");

  assert(isLoopbackHabitatUrl("http://127.0.0.1:2658"), "loopback detect");
  const mapped = mappedLoopbackHabitatUrl(2658, "http://127.0.0.1:2658");
  assert(mapped.includes("127.0.0.1"), `tunnel map: ${mapped}`);

  console.log("[smoke-ssh] anima-client --ssh 缺 workspace 应失败…");
  const bad = await $`${DIST_CLIENT} coding --ssh user@host`.nothrow().quiet();
  assert(bad.exitCode !== 0, "缺 --workspace 应非 0");
  const errText = `${String(bad.stderr)}${String(bad.stdout)}`;
  assert(
    /workspace|SSH/i.test(errText),
    `错误信息应提及 workspace/SSH，实际：${errText.slice(0, 400)}`,
  );

  console.log("[smoke-ssh] OK（自动化门闩）");
  console.log(`
手测清单（需真实环境）：
1. 公网 Habitat + 远端 Linux：
   anima-client coding --ssh user@host --workspace /abs/path
   桌面 New Agent → SSH 远程 → 树/预览/对话工具
2. loopback Habitat（触发 ssh -R）：
   Habitat 在 127.0.0.1:2658；同上；退出后确认隧道进程已停
`);
}

await main();
