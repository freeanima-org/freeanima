import {
  FileConfig,
  getConfiguredDatabaseUrl,
  writeLoopbackWebAuthTokenFile,
} from "@freeanima/platform/config";
import { resolveAndBindWorldContext } from "@freeanima/core/config/world-context";
import { runMigrations } from "@freeanima/core/db";
import { closeDb, getDb, initDatabase } from "@freeanima/core/db/pg";
import {
  createServiceApiTokenWithSecret,
  listServiceApiTokensBySubject,
  revokeServiceApiToken,
  verifyServiceApiToken,
} from "@freeanima/core/db/pg/service-api-token";
import type { Command } from "commander";

import { printCliError } from "../output/errors.ts";
import { writeStatusLine } from "../output/status.ts";

async function withDb<T>(fn: () => Promise<T>): Promise<T> {
  const fileConfig = FileConfig.open();
  const url = await getConfiguredDatabaseUrl(fileConfig.data);
  if (!url) {
    throw new Error("database.url 未配置；请在 config.yaml 或 DATABASE_URL 中设置 PostgreSQL 连接");
  }
  initDatabase({ getDatabaseUrl: () => url });
  await runMigrations(getDb());
  await resolveAndBindWorldContext(fileConfig.data);
  try {
    return await fn();
  } finally {
    await closeDb();
  }
}

export function registerTokenCommand(program: Command): void {
  const tokenCmd = program
    .command("token")
    .description("管理 Hub Service API Token（直连 PostgreSQL，不经 HTTP）");

  tokenCmd
    .command("create")
    .description("为 subject 创建 API token（明文仅此次输出）")
    .requiredOption("--subject-id <id>", "user/agent subject entity id", parseInt)
    .requiredOption("--name <name>", "token 名称，如 bootstrap / desktop")
    .action(async (opts: { subjectId: number; name: string }) => {
      try {
        const result = await withDb(async () =>
          createServiceApiTokenWithSecret({
            subject_id: opts.subjectId,
            name: opts.name.trim(),
          }),
        );
        console.log(result.plaintext);
        writeStatusLine(
          "ok",
          `已创建 token id=${result.token.id} subject_id=${result.token.subject_id} name=${result.token.name}`,
        );
        writeStatusLine("hint", "Hub 托管 Web：anima token pin-loopback <token>");
      } catch (e) {
        printCliError(e);
        process.exit(1);
      }
    });

  tokenCmd
    .command("pin-loopback")
    .description(
      "将已有 Service API Token 写入 ~/.anima/web/loopback-auth.token（Hub 托管 Web UI）",
    )
    .argument("<token>", "anima token create 输出的明文 token")
    .action(async (token: string) => {
      try {
        const trimmed = token.trim();
        await withDb(async () => {
          const verified = await verifyServiceApiToken(trimmed);
          if (!verified) {
            throw new Error("token 无效或已撤销");
          }
          writeLoopbackWebAuthTokenFile(trimmed);
        });
        writeStatusLine("ok", "已写入 loopback web auth token");
      } catch (e) {
        printCliError(e);
        process.exit(1);
      }
    });

  tokenCmd
    .command("list")
    .description("列出某 subject 的 token（不含 secret）")
    .requiredOption("--subject-id <id>", "subject entity id", parseInt)
    .action(async (opts: { subjectId: number }) => {
      try {
        const items = await withDb(async () => listServiceApiTokensBySubject(opts.subjectId));
        if (items.length === 0) {
          console.log("(no tokens)");
          return;
        }
        for (const row of items) {
          console.log(
            `${row.id}\t${row.prefix}\t${row.name}\t${row.scopes.join(",")}\trevoked=${row.revoked_at ? "yes" : "no"}`,
          );
        }
      } catch (e) {
        printCliError(e);
        process.exit(1);
      }
    });

  tokenCmd
    .command("revoke")
    .description("撤销 token")
    .argument("<id>", "token id", parseInt)
    .action(async (id: number) => {
      try {
        const ok = await withDb(async () => revokeServiceApiToken(id));
        if (!ok) {
          throw new Error(`token ${id} 不存在或已撤销`);
        }
        writeStatusLine("ok", `已撤销 token id=${id}`);
      } catch (e) {
        printCliError(e);
        process.exit(1);
      }
    });
}
