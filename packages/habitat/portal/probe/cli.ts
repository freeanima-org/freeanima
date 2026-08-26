#!/usr/bin/env bun
/**
 * anima-probe — Coding（及其它）执行端 Outpost。
 * 直连 Habitat `remote_tools.attach`；无 Habitat 运行时依赖。
 */
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { Command } from "commander";

import { CODING_APP_ID } from "@freeanima/shared/coding/constants.ts";
import {
  CODING_BASE_TOOLS,
  createNodeWorkspaceBackend,
  executeCodingOutpostTool,
} from "@freeanima/shared/coding/outpost";
import { fileRemoteInstanceStore } from "@freeanima/shared/rpc-contract/instance-store-node.ts";
import { createRemoteToolsHabitatAttach } from "@freeanima/shared/rpc-contract/remote-tools-attach.ts";

function defaultInstancePath(appId: string): string {
  return join(homedir(), ".anima", "outpost", appId, "instance.json");
}

function requireEnv(name: string, fallback?: string): string {
  const v = process.env[name]?.trim() || fallback?.trim();
  if (!v) {
    throw new Error(`缺少 ${name}`);
  }
  return v;
}

async function runCodingProbe(opts: {
  habitatUrl: string;
  token: string;
  workspaceRoot: string;
  instanceFile?: string;
}): Promise<void> {
  const workspaceRoot = resolve(opts.workspaceRoot);
  const backend = createNodeWorkspaceBackend();
  const instanceStore = fileRemoteInstanceStore(
    opts.instanceFile?.trim() || defaultInstancePath(CODING_APP_ID),
  );

  const attach = createRemoteToolsHabitatAttach({
    appId: CODING_APP_ID,
    habitatUrl: opts.habitatUrl.replace(/\/$/, ""),
    remoteAuthToken: opts.token,
    instanceStore,
    tools: CODING_BASE_TOOLS,
    toolsetVisibility: "catalog",
    onToolCall: async (localName, args, ctx) => {
      const root = ctx.workspace_root?.trim() || workspaceRoot;
      return executeCodingOutpostTool(localName, args, {
        workspaceRoot: root,
        backend,
      });
    },
    onConnected: (_client, instanceId) => {
      console.error(`[anima-probe] attached app=${CODING_APP_ID} instance_id=${instanceId}`);
      console.error(`[anima-probe] workspace_root=${workspaceRoot}`);
    },
  });

  const shutdown = (): void => {
    attach.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await attach.whenConnected();
  console.error("[anima-probe] ready（Ctrl+C 退出）");
  await new Promise(() => {
    /* run until signal */
  });
}

const program = new Command()
  .name("anima-probe")
  .description("FreeAnima 探针 — 执行端 Outpost（首版：coding toolset）")
  .option("--habitat-url <url>", "栖息地 URL", process.env.ANIMA_HABITAT_URL)
  .option("--token <token>", "Service API Token", process.env.ANIMA_TOKEN)
  .option("--workspace <path>", "工作区根目录", process.env.ANIMA_WORKSPACE ?? process.cwd())
  .option("--instance-file <path>", "instance_id 持久化路径")
  .action(
    async (opts: {
      habitatUrl?: string;
      token?: string;
      workspace: string;
      instanceFile?: string;
    }) => {
      try {
        const habitatUrl = requireEnv("ANIMA_HABITAT_URL", opts.habitatUrl);
        const token = requireEnv("ANIMA_TOKEN", opts.token);
        await runCodingProbe({
          habitatUrl,
          token,
          workspaceRoot: opts.workspace,
          ...(opts.instanceFile ? { instanceFile: opts.instanceFile } : {}),
        });
      } catch (e) {
        console.error(e instanceof Error ? e.message : String(e));
        process.exit(1);
      }
    },
  );

await program.parseAsync(process.argv);
