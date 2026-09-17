/**
 * 聊天 LLM 调试开关：SSOT 为 Habitat runtime `chat.llm_debug_enabled`。
 * 本地仅作缓存；写路径只走 habitat patch。
 */

import { isRecord } from "@freeanima/shared/util";

import { fetchHabitatConfigSection, patchHabitatConfigSection } from "./habitat-config-api.ts";

/** @deprecated 仅作本地缓存键；勿再当作本机独立设置 */
export const CHAT_LLM_DEBUG_ENABLED_KEY = "freeanima.chat.llmDebugEnabled";

type ChatPrefsListener = () => void;
const listeners = new Set<ChatPrefsListener>();

let cachedLlmDebugEnabled = false;
let loadPromise: Promise<void> | null = null;

function storage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function readLocalCache(): boolean | null {
  try {
    const raw = storage()?.getItem(CHAT_LLM_DEBUG_ENABLED_KEY);
    if (raw == null) return null;
    return raw === "1";
  } catch {
    return null;
  }
}

function writeLocalCache(enabled: boolean): void {
  try {
    const store = storage();
    if (!store) return;
    if (enabled) store.setItem(CHAT_LLM_DEBUG_ENABLED_KEY, "1");
    else store.removeItem(CHAT_LLM_DEBUG_ENABLED_KEY);
  } catch {
    // ignore
  }
}

function notify(): void {
  for (const listener of listeners) listener();
}

function applyCache(enabled: boolean): void {
  cachedLlmDebugEnabled = enabled;
  writeLocalCache(enabled);
  notify();
}

// 模块加载时用本地镜像作瞬时值，随后 ensure/refresh 以 Habitat 为准
cachedLlmDebugEnabled = readLocalCache() === true;

/** 同步读：内存缓存（保存后与 Habitat 同步；启动瞬间可能来自 localStorage 镜像） */
export function readChatLlmDebugEnabled(): boolean {
  return cachedLlmDebugEnabled;
}

/** Habitat 已写入后同步本地缓存（避免再 patch） */
export function setChatLlmDebugEnabledCache(enabled: boolean): void {
  applyCache(enabled);
}

export async function refreshChatLlmDebugEnabled(): Promise<boolean> {
  try {
    const section = await fetchHabitatConfigSection("chat");
    const enabled = isRecord(section) && section.llm_debug_enabled === true;
    applyCache(enabled);
    return enabled;
  } catch {
    return readChatLlmDebugEnabled();
  }
}

export function ensureChatLlmDebugPrefsLoaded(): Promise<void> {
  if (loadPromise == null) {
    loadPromise = refreshChatLlmDebugEnabled().then(() => undefined);
  }
  return loadPromise;
}

/** 写：乐观更新缓存 + patch Habitat chat 段 */
export function writeChatLlmDebugEnabled(enabled: boolean): void {
  applyCache(enabled);
  void patchHabitatConfigSection("chat", { llm_debug_enabled: enabled }).catch(() => {
    void refreshChatLlmDebugEnabled();
  });
}

export function subscribeChatLlmDebugEnabled(listener: ChatPrefsListener): () => void {
  listeners.add(listener);
  void ensureChatLlmDebugPrefsLoaded();
  return () => {
    listeners.delete(listener);
  };
}

export function resetChatPrefsForTest(): void {
  cachedLlmDebugEnabled = false;
  loadPromise = null;
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(CHAT_LLM_DEBUG_ENABLED_KEY);
  }
}
