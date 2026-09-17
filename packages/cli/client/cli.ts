#!/usr/bin/env bun
/**
 * anima-client — 客户端/操作台 CLI。
 * 首版：配置连接与 token；coding TUI（订 Habitat 流，tool 由 anima-probe 执行）。
 */
import { Command } from "commander";

import { configPath, loadConfig, maskToken, saveConfig } from "./config.ts";
import { connectHabitatClient } from "./habitat-connect.ts";
import { runCodingTui } from "./coding-tui.ts";

const program = new Command()
  .name("anima-client")
  .description("FreeAnima 客户端 — 操作台（连接配置 + coding TUI）")
  .showHelpAfterError("(use --help for usage)");

program
  .command("config")
  .description("查看或写入 Habitat 连接")
  .option("--habitat-url <url>", "栖息地 URL")
  .option("--token <token>", "Service API Token")
  .option("--show", "打印当前配置（token 脱敏）")
  .action((opts: { habitatUrl?: string; token?: string; show?: boolean }) => {
    if (opts.show || (!opts.habitatUrl && !opts.token)) {
      const cfg = loadConfig();
      if (!cfg) {
        console.log("尚未配置。用法: anima-client config --habitat-url <url> --token <token>");
        process.exit(1);
      }
      console.log(
        JSON.stringify({ habitat_url: cfg.habitat_url, token: maskToken(cfg.token) }, null, 2),
      );
      return;
    }
    const prev = loadConfig();
    const habitat_url = (opts.habitatUrl ?? prev?.habitat_url ?? "").trim();
    const token = (opts.token ?? prev?.token ?? "").trim();
    if (!habitat_url || !token) {
      console.error("需要 --habitat-url 与 --token（或已有配置上补全）");
      process.exit(1);
    }
    saveConfig({ habitat_url, token });
    console.log(`已写入 ${configPath()}`);
  });

program
  .command("coding")
  .description("编码操作台 TUI（列表 / 新建会话 / 发消息；订 Habitat 流）")
  .option("--list", "仅列出 coding 会话后退出")
  .option("--limit <n>", "列表条数", "50")
  .option("--conversation <id>", "复用已有会话 id")
  .option("--workspace <path>", "工作区路径（本地绝对路径，或 SSH 时的远端绝对路径）")
  .option("--instance-id <id>", "指定 coding probe instance_id")
  .option("--message <text>", "非交互：发一条消息后退出")
  .option("--no-spawn-probe", "禁用本机自动启动 anima-probe（SSH 模式忽略）")
  .option("--ssh <user@host>", "SSH Remote：经本机 ssh 在远端启 anima-probe")
  .option("--port <n>", "SSH 端口")
  .option("--identity <path>", "SSH 私钥路径")
  .action(
    async (opts: {
      list?: boolean;
      limit: string;
      conversation?: string;
      workspace?: string;
      instanceId?: string;
      message?: string;
      spawnProbe?: boolean;
      ssh?: string;
      port?: string;
      identity?: string;
    }) => {
      const cfg = loadConfig();
      if (!cfg) {
        console.error("请先: anima-client config --habitat-url <url> --token <token>");
        process.exit(1);
      }
      const session = await connectHabitatClient({
        habitatUrl: cfg.habitat_url,
        token: cfg.token,
      });
      try {
        await runCodingTui({
          session,
          listOnly: Boolean(opts.list),
          limit: Math.max(1, Number(opts.limit) || 50),
          conversationId: opts.conversation ?? null,
          workspaceRoot: opts.workspace ?? null,
          instanceId: opts.instanceId ?? null,
          message: opts.message ?? null,
          autoSpawnProbe: opts.spawnProbe !== false,
          ssh: opts.ssh
            ? {
                target: opts.ssh,
                ...(opts.port ? { port: Number(opts.port) } : {}),
                ...(opts.identity ? { identityFile: opts.identity } : {}),
              }
            : null,
        });
      } finally {
        session.stop();
      }
    },
  );

await program.parseAsync(process.argv);
