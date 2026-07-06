import type { Command } from "commander";

import { FileConfig, getConfiguredDatabaseUrl } from "@freeanima/platform/config";
import { resolveAndBindWorldContext } from "@freeanima/core/config/world-context";
import { runMigrations } from "@freeanima/core/db";
import { closeDb, getDb, initDatabase } from "@freeanima/core/db/pg";

import {
  getAgentVaultCliField,
  listAgentVaultCliItems,
} from "@freeanima/platform/commands/vault-cli";

import { printCliError } from "../output/errors.ts";
import { renderTable } from "../output/table.ts";

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

export function registerVaultCommand(program: Command): void {
  const vaultCmd = program
    .command("vault")
    .description("Agent 保险库 CLI（元数据列表 / headless 读字段，不含 User 库主密码）");

  vaultCmd
    .command("list")
    .description("List agent vault items (metadata only)")
    .action(async () => {
      try {
        const items = await withDb(async () => listAgentVaultCliItems());
        if (items.length === 0) {
          console.log("(no vault items in agent library)");
          return;
        }
        const rows = items.map((item) => [
          String(item.id),
          item.title,
          item.item_type,
          item.custom_field_names.join(", "),
        ]);
        console.log(renderTable(rows, ["ID", "Title", "Type", "Custom fields"]));
      } catch (e) {
        printCliError(e);
        process.exit(1);
      }
    });

  vaultCmd
    .command("get")
    .description("Read agent vault field (stdout, for scripts)")
    .argument("<id>", "vault_item entity id")
    .argument("<field>", "field path, e.g. password or custom_fields.0.value")
    .action(async (idRaw: string, field: string) => {
      const id = Number(idRaw);
      if (!Number.isFinite(id) || id <= 0) {
        printCliError(new Error("invalid vault item id"));
        process.exit(1);
      }
      try {
        console.log(await withDb(async () => getAgentVaultCliField(id, field)));
      } catch (e) {
        printCliError(e);
        process.exit(1);
      }
    });
}
