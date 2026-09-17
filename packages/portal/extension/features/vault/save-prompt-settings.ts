const MUTED_HOSTS_KEY = "freeanima.vault_ext.save_prompt_muted_hosts";

export function normalizeSavePromptHost(hostname: string): string {
  const trimmed = hostname.trim().toLowerCase();
  return trimmed.startsWith("www.") ? trimmed.slice(4) : trimmed;
}

type StorageLike = {
  get(key: string): Promise<Record<string, unknown>>;
  set(data: Record<string, unknown>): Promise<void>;
};

function createChromeLocalStorage(): StorageLike {
  return {
    async get(key: string) {
      return chrome.storage.local.get(key) as Promise<Record<string, unknown>>;
    },
    async set(data: Record<string, unknown>) {
      await chrome.storage.local.set(data);
    },
  };
}

let storage: StorageLike = createChromeLocalStorage();

/** 单测可注入内存 storage */
export function setSavePromptSettingsStorageForTest(next: StorageLike | null): void {
  storage = next ?? createChromeLocalStorage();
}

async function loadMutedHosts(): Promise<string[]> {
  const data = await storage.get(MUTED_HOSTS_KEY);
  const raw = data[MUTED_HOSTS_KEY];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((h): h is string => typeof h === "string")
    .map(normalizeSavePromptHost)
    .filter(Boolean);
}

export async function isSavePromptMuted(hostname: string): Promise<boolean> {
  const host = normalizeSavePromptHost(hostname);
  if (!host) return false;
  const muted = await loadMutedHosts();
  return muted.includes(host);
}

export async function muteSavePromptForHost(hostname: string): Promise<void> {
  const host = normalizeSavePromptHost(hostname);
  if (!host) return;
  const muted = await loadMutedHosts();
  if (muted.includes(host)) return;
  await storage.set({ [MUTED_HOSTS_KEY]: [...muted, host] });
}
