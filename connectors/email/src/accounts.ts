import type { Config } from "@freeanima/storage-config";
import { FileConfig, emailAccountSchema, resolveValue } from "@freeanima/service-config";

import type { EmailAccount, EmailAccountInput, EmailAccountPatch } from "./types.ts";
import { emailAccountInputSchema, emailAccountPatchSchema } from "./types.ts";

let emailAccountsConfig: Config | null = null;

export function bindEmailAccountsConfig(config: Config): void {
  emailAccountsConfig = config;
}

export function resetEmailAccountsConfigForTest(): void {
  emailAccountsConfig = null;
}

function requireEmailAccountsConfig(): Config {
  if (!emailAccountsConfig) {
    throw new Error("Email accounts config not bound; call bindEmailAccountsConfig first");
  }
  return emailAccountsConfig;
}

export function getEmailAccounts(): EmailAccount[] {
  const cfg = requireEmailAccountsConfig().data;
  return cfg.email?.accounts ?? [];
}

function saveEmailAccounts(accounts: EmailAccount[]): void {
  const config = requireEmailAccountsConfig();
  if (config instanceof FileConfig) {
    config.patchSection("email", { accounts });
    return;
  }
  config.update({ ...config.data, email: { ...config.data.email, accounts } });
}

function normalizeDefaultSender(accounts: EmailAccount[]): EmailAccount[] {
  const enabled = accounts.filter((a) => a.enabled !== false);
  if (enabled.length === 0) return accounts;

  const defaults = accounts.filter((a) => a.default_sender);
  if (defaults.length === 1) return accounts;

  if (defaults.length === 0) {
    const firstEnabledIdx = accounts.findIndex((a) => a.enabled !== false);
    if (firstEnabledIdx < 0) return accounts;
    return accounts.map((a, i) => ({
      ...a,
      default_sender: i === firstEnabledIdx,
    }));
  }

  let kept = false;
  return accounts.map((a) => {
    if (!a.default_sender) return a;
    if (!kept) {
      kept = true;
      return a;
    }
    return { ...a, default_sender: false };
  });
}

async function assertPasswordResolvable(account: Pick<EmailAccount, "password">): Promise<void> {
  try {
    await resolveValue(account.password);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Email password could not be resolved: ${msg}`, { cause: err });
  }
}

export async function resolveAccountPassword(account: EmailAccount): Promise<string> {
  return resolveValue(account.password);
}

export async function registerEmailAccount(input: EmailAccountInput): Promise<EmailAccount> {
  const parsed = emailAccountInputSchema.parse(input);
  const accounts = getEmailAccounts();
  if (accounts.some((a) => a.id === parsed.id)) {
    throw new Error(`Email account already exists: ${parsed.id}`);
  }

  await assertPasswordResolvable(parsed);

  let next = [...accounts, parsed];
  if (parsed.default_sender) {
    next = next.map((a) => (a.id === parsed.id ? a : { ...a, default_sender: false }));
  }
  next = normalizeDefaultSender(next);
  saveEmailAccounts(next);
  return next.find((a) => a.id === parsed.id)!;
}

export function editEmailAccount(id: string, patch: EmailAccountPatch): EmailAccount {
  const parsed = emailAccountPatchSchema.parse(patch);
  const accounts = getEmailAccounts();
  const idx = accounts.findIndex((a) => a.id === id);
  if (idx < 0) throw new Error(`Email account not found: ${id}`);

  const merged = emailAccountSchema.parse({ ...accounts[idx], ...parsed, id });
  let next = accounts.map((a, i) => (i === idx ? merged : a));
  if (merged.default_sender) {
    next = next.map((a) => (a.id === id ? a : { ...a, default_sender: false }));
  }
  next = normalizeDefaultSender(next);
  saveEmailAccounts(next);
  return next.find((a) => a.id === id)!;
}

export function listEmailAccounts(): EmailAccount[] {
  return getEmailAccounts();
}

export function deleteEmailAccount(id: string): void {
  const accounts = getEmailAccounts();
  if (!accounts.some((a) => a.id === id)) {
    throw new Error(`Email account not found: ${id}`);
  }
  let next = accounts.filter((a) => a.id !== id);
  next = normalizeDefaultSender(next);
  saveEmailAccounts(next);
}

export function getDefaultSender(): EmailAccount | null {
  const accounts = getEmailAccounts().filter((a) => a.enabled !== false);
  return accounts.find((a) => a.default_sender) ?? accounts[0] ?? null;
}

export function resolveAccount(accountId?: string): EmailAccount {
  const accounts = getEmailAccounts().filter((a) => a.enabled !== false);
  if (accounts.length === 0) {
    throw new Error("No enabled email accounts configured");
  }

  if (accountId) {
    const account = accounts.find((a) => a.id === accountId);
    if (!account) throw new Error(`Email account not found or disabled: ${accountId}`);
    return account;
  }

  const fallback = getDefaultSender();
  if (!fallback || fallback.enabled === false) {
    throw new Error("No default sender account found");
  }
  return fallback;
}

export function resolveEnabledAccounts(accountId?: string): EmailAccount[] {
  if (accountId) return [resolveAccount(accountId)];
  const accounts = getEmailAccounts().filter((a) => a.enabled !== false);
  if (accounts.length === 0) throw new Error("No enabled email accounts configured");
  return accounts;
}
