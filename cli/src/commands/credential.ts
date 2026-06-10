import {
  credential,
  insertCredential,
  listCredentials,
  updateCredential,
  type CredentialMeta,
} from "@freeanima/service-config";
import type { Command } from "commander";

import { printCliError } from "../output/errors.ts";
import { renderTable } from "../output/table.ts";
import { writeStatusLine } from "../output/status.ts";

export type CredentialCommandDeps = {
  listCredentials: () => CredentialMeta[];
  credential: (path: string, field: string) => string;
  insertCredential: (path: string, data: Record<string, string>) => string;
  updateCredential: (path: string, data: Record<string, string>) => string;
};

const defaultCredentialDeps: CredentialCommandDeps = {
  listCredentials,
  credential,
  insertCredential,
  updateCredential,
};

export function parseKeyValues(pairs: string[]): Record<string, string> {
  const data: Record<string, string> = {};
  for (const pair of pairs) {
    const eq = pair.indexOf("=");
    if (eq <= 0) {
      throw new Error(`Invalid argument '${pair}', format should be key=value`);
    }
    data[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  if (Object.keys(data).length === 0) {
    throw new Error("At least one key=value argument required");
  }
  return data;
}

export function registerCredentialCommand(
  program: Command,
  deps: CredentialCommandDeps = defaultCredentialDeps,
): void {
  const credentialCmd = program
    .command("credential")
    .description("Manage pass credentials (no secret plaintext echoed to logs)");

  credentialCmd
    .command("list")
    .description("List credential paths and field metadata")
    .action(() => {
      const creds = deps.listCredentials();
      if (!creds.length) {
        console.log("(no credentials)");
        return;
      }
      const rows = creds.map((c) => [c.path, c.tags.join(", "), c.desc, c.fields.join(", ")]);
      console.log(renderTable(rows, ["Path", "Tags", "Description", "Fields"]));
    });

  credentialCmd
    .command("get")
    .description("Read credential value (stdout, for scripts)")
    .argument("<path>", "Credential path, e.g. services/discord")
    .argument("<field>", "YAML field name, e.g. token, url")
    .action((path: string, field: string) => {
      try {
        console.log(deps.credential(path, field));
      } catch (e) {
        printCliError(e);
        process.exit(1);
      }
    });

  credentialCmd
    .command("add")
    .description("Create or fully overwrite credential (YAML), args format key=value")
    .argument("<path>", "Credential path")
    .argument("<kv...>", "Fields, e.g. token=xxx desc=Discord bot")
    .action((path: string, kv: string[]) => {
      try {
        const data = parseKeyValues(kv);
        deps.insertCredential(path, data);
        writeStatusLine("ok", `Written ${path}`);
      } catch (e) {
        printCliError(e);
        process.exit(1);
      }
    });

  credentialCmd
    .command("set")
    .description("Update credential fields (merge into existing YAML, untouched fields preserved)")
    .argument("<path>", "Credential path")
    .argument("<kv...>", "Fields, e.g. npmtoken=xxx desc=updated")
    .action((path: string, kv: string[]) => {
      try {
        const data = parseKeyValues(kv);
        deps.updateCredential(path, data);
        writeStatusLine("ok", `Updated ${path}`);
      } catch (e) {
        printCliError(e);
        process.exit(1);
      }
    });
}
