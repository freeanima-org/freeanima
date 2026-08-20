import { withPlatformDb } from "@freeanima/habitat/platform/config";
import {
  createServiceApiTokenWithSecret,
  listServiceApiTokensBySubject,
  revealServiceApiTokenPlaintext,
  revokeServiceApiToken,
  updateServiceApiTokenName,
} from "@freeanima/habitat/core/db/pg/service-api-token";
import {
  expandTokenPreset,
  FULL_TOKEN_AUTHORIZATION,
  type TokenAuthorizationPreset,
} from "@freeanima/shared/service-api-auth";
import type { Command } from "commander";

import { printCliError } from "../output/errors.ts";
import { writeStatusLine } from "../output/status.ts";

function formatAuthorization(authz: {
  full: boolean;
  portal?: string;
  modules?: readonly string[];
}): string {
  if (authz.full) return "full";
  return `${authz.portal};modules=${(authz.modules ?? []).join(",")}`;
}

export function registerTokenCommand(program: Command): void {
  const tokenCmd = program
    .command("token")
    .description("管理 Habitat Service API Token（直连 PostgreSQL，不经 HTTP）");

  tokenCmd
    .command("create")
    .description("为 subject 创建 API token（明文输出；之后可用 reveal 再取）")
    .requiredOption("--subject-id <id>", "user/agent subject entity id", parseInt)
    .requiredOption("--name <name>", "token 名称，如 bootstrap / desktop")
    .option("--preset <preset>", "授权预设：full | app | extension | mcp", "full")
    .option(
      "--world-id <id>",
      "限制可访问 world（可重复；仅非 full 预设）",
      (value: string, prev: number[]) => {
        prev.push(parseInt(value, 10));
        return prev;
      },
      [] as number[],
    )
    .action(
      async (opts: { subjectId: number; name: string; preset: string; worldId: number[] }) => {
        try {
          const preset = opts.preset.trim().toLowerCase();
          if (preset !== "full" && !["app", "extension", "mcp"].includes(preset)) {
            throw new Error(`unknown preset: ${preset} (use full|app|extension|mcp)`);
          }
          const worldIds = opts.worldId.filter((id) => Number.isFinite(id) && id > 0);
          const authorization =
            preset === "full"
              ? FULL_TOKEN_AUTHORIZATION
              : expandTokenPreset(
                  preset as TokenAuthorizationPreset,
                  worldIds.length > 0 ? { worldIds } : undefined,
                );
          const result = await withPlatformDb(
            async () =>
              createServiceApiTokenWithSecret({
                subject_id: opts.subjectId,
                name: opts.name.trim(),
                authorization,
              }),
            { bindWorldContext: true },
          );
          console.log(result.plaintext);
          writeStatusLine(
            "ok",
            `已创建 token id=${result.token.id} subject_id=${result.token.subject_id} name=${result.token.name} auth=${formatAuthorization(result.token.authorization)}`,
          );
          writeStatusLine("hint", "请在客户端连接设置中配置 Service API Token");
        } catch (e) {
          printCliError(e);
          process.exit(1);
        }
      },
    );

  tokenCmd
    .command("list")
    .description("列出某 subject 的 token（不含 secret；revealable 表示可再次 reveal）")
    .requiredOption("--subject-id <id>", "subject entity id", parseInt)
    .action(async (opts: { subjectId: number }) => {
      try {
        const items = await withPlatformDb(async () =>
          listServiceApiTokensBySubject(opts.subjectId),
        );
        if (items.length === 0) {
          console.log("(no tokens)");
          return;
        }
        for (const row of items) {
          console.log(
            `${row.id}\t${row.prefix}\t${row.name}\t${formatAuthorization(row.authorization)}\trevealable=${row.revealable ? "yes" : "no"}\trevoked=${row.revoked_at ? "yes" : "no"}`,
          );
        }
      } catch (e) {
        printCliError(e);
        process.exit(1);
      }
    });

  tokenCmd
    .command("reveal")
    .description("再次输出 token 明文（需创建时已存档 secret）")
    .argument("<id>", "token id", parseInt)
    .action(async (id: number) => {
      try {
        const plaintext = await withPlatformDb(async () => revealServiceApiTokenPlaintext(id));
        console.log(plaintext);
        writeStatusLine("ok", `已 reveal token id=${id}`);
      } catch (e) {
        printCliError(e);
        process.exit(1);
      }
    });

  tokenCmd
    .command("rename")
    .description("修改 token 名称")
    .argument("<id>", "token id", parseInt)
    .requiredOption("--name <name>", "新名称")
    .action(async (id: number, opts: { name: string }) => {
      try {
        const token = await withPlatformDb(async () =>
          updateServiceApiTokenName(id, opts.name.trim()),
        );
        writeStatusLine("ok", `已改名 token id=${token.id} name=${token.name}`);
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
        const ok = await withPlatformDb(async () => revokeServiceApiToken(id));
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
