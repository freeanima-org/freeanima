import type { Command } from "commander";

import { withPlatformDb } from "@freeanima/platform/config";

import {
  getAgentVaultCliField,
  listAgentVaultCliItems,
} from "@freeanima/platform/slash-commands/vault-cli.ts";

import { printCliError } from "../output/errors.ts";
import { renderTable } from "../output/table.ts";

export function registerVaultCommand(program: Command): void {
  const vaultCmd = program
    .command("vault")
    .description("Agent 保险库 CLI（元数据列表 / headless 读字段，不含 User 库主密码）");

  vaultCmd
    .command("list")
    .description("List agent vault items (metadata only)")
    .action(async () => {
      try {
        const items = await withPlatformDb(async () => listAgentVaultCliItems(), {
          bindWorldContext: true,
        });
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
        console.log(
          await withPlatformDb(async () => getAgentVaultCliField(id, field), {
            bindWorldContext: true,
          }),
        );
      } catch (e) {
        printCliError(e);
        process.exit(1);
      }
    });
}
