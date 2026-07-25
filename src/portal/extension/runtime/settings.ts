export type VaultExtSettings = {
  habitat_url: string;
  auth_token: string;
};

const KEY = "freeanima.vault_ext.settings";

export async function loadSettings(): Promise<VaultExtSettings> {
  const data = await chrome.storage.local.get(KEY);
  const raw = data[KEY] as VaultExtSettings | undefined;
  return {
    habitat_url: raw?.habitat_url?.trim() ?? "",
    auth_token: raw?.auth_token?.trim() ?? "",
  };
}

export async function saveSettings(settings: VaultExtSettings): Promise<void> {
  await chrome.storage.local.set({
    [KEY]: {
      habitat_url: settings.habitat_url.trim().replace(/\/$/, ""),
      auth_token: settings.auth_token.trim(),
    },
  });
}
