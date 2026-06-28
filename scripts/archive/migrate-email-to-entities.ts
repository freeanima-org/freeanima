#!/usr/bin/env bun
/**
 * 一次性迁移：config.yaml `email.accounts[]` → entity `email_account`。
 *
 *   DATABASE_URL=postgres://… bun scripts/migrate-email-to-entities.ts
 *   DATABASE_URL=postgres://… bun scripts/archive/migrate-email-to-entities.ts --dry-run
 */

import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { bindActiveConfig } from "../../platform/config/index.ts";
import {
  createEmailAccount,
  findEmailAccountByAddressAndHost,
} from "../../capabilities/email/src/index.ts";
import { FileConfig } from "../../platform/config/file-config.ts";
import { parseYaml } from "../../platform/config/yaml.ts";
import { initDatabase, closeDb } from "../../core/src/db/pg/index.ts";

type LegacyAccount = {
  id: string;
  password: string;
  address: string;
  display_name?: string;
  smtp_host: string;
  smtp_port: number;
  imap_host: string;
  imap_port: number;
  default_sender?: boolean;
  enabled?: boolean;
  desc?: string;
  tags?: string[];
};

function resolveConfigPath(): string {
  const fromEnv = process.env.FREEANIMA_HOME?.trim();
  const base = fromEnv && fromEnv.length > 0 ? fromEnv : join(homedir(), ".anima");
  return join(base, "config.yaml");
}

function readLegacyAccounts(raw: unknown): LegacyAccount[] {
  if (!raw || typeof raw !== "object") return [];
  const email = (raw as { email?: { accounts?: unknown } }).email;
  if (!email || !Array.isArray(email.accounts)) return [];
  return email.accounts.filter(
    (a): a is LegacyAccount =>
      !!a &&
      typeof a === "object" &&
      typeof (a as LegacyAccount).id === "string" &&
      typeof (a as LegacyAccount).address === "string" &&
      typeof (a as LegacyAccount).password === "string" &&
      typeof (a as LegacyAccount).smtp_host === "string" &&
      typeof (a as LegacyAccount).imap_host === "string",
  );
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  initDatabase({ getDatabaseUrl: () => url });
  bindActiveConfig(FileConfig.open());

  const configPath = resolveConfigPath();
  if (!existsSync(configPath)) {
    console.log(`config not found: ${configPath}`);
    return;
  }

  const accounts = readLegacyAccounts(parseYaml(readFileSync(configPath, "utf8")));
  if (accounts.length === 0) {
    console.log("no legacy email.accounts to migrate");
    return;
  }

  try {
    let migrated = 0;
    for (const account of accounts) {
      const existing = await findEmailAccountByAddressAndHost(account.address, account.smtp_host);
      if (existing) {
        console.log(`skip existing: ${account.address} (${existing.id})`);
        continue;
      }
      if (dryRun) {
        console.log(`[dry-run] would migrate: ${account.id} -> ${account.address}`);
        migrated += 1;
        continue;
      }
      const row = await createEmailAccount({
        password: account.password,
        address: account.address,
        display_name: account.display_name,
        smtp_host: account.smtp_host,
        smtp_port: account.smtp_port,
        imap_host: account.imap_host,
        imap_port: account.imap_port,
        default_sender: account.default_sender,
        enabled: account.enabled,
        desc: account.desc,
        tags: account.tags,
      });
      console.log(`migrated ${account.id} -> entity ${row.id} (${row.address})`);
      migrated += 1;
    }

    console.log(`done: ${migrated} account(s)${dryRun ? " (dry-run)" : ""}`);
  } finally {
    await closeDb();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
