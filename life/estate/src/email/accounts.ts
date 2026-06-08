import {
  credential,
  emailAccountSchema,
  loadConfig,
  patchConfigSection,
} from "@freeanima/service-config";

import type { EmailAccount, EmailAccountInput, EmailAccountPatch } from "./types.ts";
import { emailAccountInputSchema, emailAccountPatchSchema } from "./types.ts";

export function getEmailAccounts(): EmailAccount[] {
  const cfg = loadConfig();
  return cfg.email?.accounts ?? [];
}

function saveEmailAccounts(accounts: EmailAccount[]): void {
  patchConfigSection("email", { accounts });
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

function credentialField(account: Pick<EmailAccount, "credential_field">): string {
  return account.credential_field ?? "password";
}

function assertCredentialExists(
  account: Pick<EmailAccount, "credential_path" | "credential_field">,
): void {
  const path = account.credential_path;
  const field = credentialField(account);
  try {
    credential(path, field);
  } catch {
    throw new Error(`pass 凭证 ${path} 不存在或缺少 ${field} 字段`);
  }
}

export function registerEmailAccount(input: EmailAccountInput): EmailAccount {
  const parsed = emailAccountInputSchema.parse(input);
  const accounts = getEmailAccounts();
  if (accounts.some((a) => a.id === parsed.id)) {
    throw new Error(`邮件账户已存在: ${parsed.id}`);
  }

  assertCredentialExists(parsed);

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
  if (idx < 0) throw new Error(`邮件账户不存在: ${id}`);

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
    throw new Error(`邮件账户不存在: ${id}`);
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
    throw new Error("未配置可用的邮件账户");
  }

  if (accountId) {
    const account = accounts.find((a) => a.id === accountId);
    if (!account) throw new Error(`邮件账户不存在或未启用: ${accountId}`);
    return account;
  }

  const fallback = getDefaultSender();
  if (!fallback || fallback.enabled === false) {
    throw new Error("未找到默认发件账户");
  }
  return fallback;
}

export function resolveEnabledAccounts(accountId?: string): EmailAccount[] {
  if (accountId) return [resolveAccount(accountId)];
  const accounts = getEmailAccounts().filter((a) => a.enabled !== false);
  if (accounts.length === 0) throw new Error("未配置可用的邮件账户");
  return accounts;
}

export function readAccountPassword(account: EmailAccount): string {
  return credential(account.credential_path, credentialField(account));
}
