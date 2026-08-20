import { clearCryptoCache } from "../features/vault/crypto-cache.ts";
import { applyExtSettingsToPortalShell } from "./portal-shell.ts";

export type VaultExtSettings = {
  habitat_url: string;
  auth_token: string;
};

const KEY = "freeanima.vault_ext.settings";

export async function loadSettings(): Promise<VaultExtSettings> {
  const data = await chrome.storage.local.get(KEY);
  const raw = data[KEY] as VaultExtSettings | undefined;
  const settings: VaultExtSettings = {
    habitat_url: raw?.habitat_url?.trim() ?? "",
    auth_token: raw?.auth_token?.trim() ?? "",
  };
  // popup/options 有 window；background SW 无 window，跳过
  applyExtSettingsToPortalShell(settings);
  return settings;
}

export async function saveSettings(settings: VaultExtSettings): Promise<void> {
  const prev = await loadSettings();
  const next = {
    habitat_url: settings.habitat_url.trim().replace(/\/$/, ""),
    auth_token: settings.auth_token.trim(),
  };
  await chrome.storage.local.set({ [KEY]: next });
  applyExtSettingsToPortalShell(next);
  // Habitat 实例或 Token 变更时清掉旧库 crypto，避免串实例离线解锁
  if (prev.habitat_url !== next.habitat_url || prev.auth_token !== next.auth_token) {
    await clearCryptoCache();
  }
}
