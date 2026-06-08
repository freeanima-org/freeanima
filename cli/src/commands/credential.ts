import {
  credential,
  insertCredential,
  listCredentials,
  updateCredential,
} from "@freeanima/service-config";
import type { Command } from "commander";

import { printCliError } from "../output/errors.ts";
import { renderTable } from "../output/table.ts";
import { writeStatusLine } from "../output/status.ts";

function parseKeyValues(pairs: string[]): Record<string, string> {
  const data: Record<string, string> = {};
  for (const pair of pairs) {
    const eq = pair.indexOf("=");
    if (eq <= 0) {
      throw new Error(`无效参数 '${pair}'，格式应为 key=value`);
    }
    data[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  if (Object.keys(data).length === 0) {
    throw new Error("至少需要一个 key=value 参数");
  }
  return data;
}

export function registerCredentialCommand(program: Command): void {
  const credentialCmd = program
    .command("credential")
    .description("管理 pass 凭证（不含密钥明文回显到日志）");

  credentialCmd
    .command("list")
    .description("列出凭证路径与字段元数据")
    .action(() => {
      const creds = listCredentials();
      if (!creds.length) {
        console.log("(无凭证)");
        return;
      }
      const rows = creds.map((c) => [c.path, c.tags.join(", "), c.desc, c.fields.join(", ")]);
      console.log(renderTable(rows, ["Path", "Tags", "Description", "Fields"]));
    });

  credentialCmd
    .command("get")
    .description("读取凭证值（输出到 stdout，供脚本使用）")
    .argument("<path>", "凭证路径，如 services/discord")
    .argument("<field>", "YAML 字段名，如 token、url")
    .action((path: string, field: string) => {
      try {
        console.log(credential(path, field));
      } catch (e) {
        printCliError(e);
        process.exit(1);
      }
    });

  credentialCmd
    .command("add")
    .description("新建或整份覆盖凭证（YAML），参数格式 key=value")
    .argument("<path>", "凭证路径")
    .argument("<kv...>", "字段，如 token=xxx desc=Discord bot")
    .action((path: string, kv: string[]) => {
      try {
        const data = parseKeyValues(kv);
        insertCredential(path, data);
        writeStatusLine("ok", `已写入 ${path}`);
      } catch (e) {
        printCliError(e);
        process.exit(1);
      }
    });

  credentialCmd
    .command("set")
    .description("更新凭证字段（合并已有 YAML，不覆盖未提及字段）")
    .argument("<path>", "凭证路径")
    .argument("<kv...>", "字段，如 npmtoken=xxx desc=updated")
    .action((path: string, kv: string[]) => {
      try {
        const data = parseKeyValues(kv);
        updateCredential(path, data);
        writeStatusLine("ok", `已更新 ${path}`);
      } catch (e) {
        printCliError(e);
        process.exit(1);
      }
    });
}
