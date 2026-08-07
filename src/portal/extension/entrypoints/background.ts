import {
  extractCustomFieldNames,
  generateTotpCode,
  type VaultCustomField,
  type VaultSecretsPayload,
} from "@freeanima/shared/vault-crypto";
import type { VaultItemMetaRowPayload } from "@freeanima/shared/rpc-contract";
import { matchVaultItemsForUrl } from "@freeanima/features/vault/domain/uri-match.ts";
import {
  clearLocalCacheMemory,
  listMetaFromCache,
  loadLocalCache,
  removeLocalCacheItem,
  saveLocalCache,
  upsertLocalCacheItem,
  type CachedVaultItem,
} from "../features/vault/local-cache.ts";
import { findExistingLogin } from "../features/vault/login-match.ts";
import { generatePassword } from "../features/vault/password-gen.ts";
import {
  EXT_SCOPE,
  clearPersistedExtVaultSession,
  ensureExtVaultSession,
  getExtVaultSession,
  isExtVaultUnlocked,
  persistExtVaultSession,
} from "../features/vault/session.ts";
import { vaultCall } from "../runtime/habitat.ts";
import { type ExtBgResponse, type ExtToBgMessage, type FillPayload } from "../runtime/messages.ts";
import { loadSettings } from "../runtime/settings.ts";

async function refreshLocalCacheFromHabitat(): Promise<CachedVaultItem[]> {
  const listed = await vaultCall("vault.list", {
    subject_kind: "user",
    limit: 2000,
  });
  const prevSecrets = new Map<number, Pick<CachedVaultItem, "secrets_enc" | "dek_wrapped">>();
  const prev = await loadLocalCache();
  if (prev) {
    for (const item of prev.items) {
      if (item.secrets_enc && item.dek_wrapped) {
        prevSecrets.set(item.id, {
          secrets_enc: item.secrets_enc,
          dek_wrapped: item.dek_wrapped,
        });
      }
    }
  }
  const items: CachedVaultItem[] = listed.items.map((meta) => {
    const sealed = prevSecrets.get(meta.id);
    return sealed ? { ...meta, ...sealed } : { ...meta };
  });
  await saveLocalCache(items);
  return items;
}

async function listItemsPreferCache(query: string): Promise<VaultItemMetaRowPayload[]> {
  if (query.trim()) {
    const searched = await vaultCall("vault.search", {
      subject_kind: "user",
      query: query.trim(),
      limit: 200,
    });
    return searched.items;
  }
  const cached = await loadLocalCache();
  if (cached) {
    return listMetaFromCache(cached);
  }
  return listMetaFromCache({
    version: 1,
    updatedAtMs: Date.now(),
    items: await refreshLocalCacheFromHabitat(),
  });
}

function toCachedMeta(item: VaultItemMetaRowPayload): CachedVaultItem {
  return { ...item };
}

/** 自动填充后 bump last_used_at：先写本地缓存，再异步上报 Habitat */
async function recordFillUsed(itemId: number): Promise<void> {
  const now = new Date().toISOString();
  const cached = await loadLocalCache();
  const prev = cached?.items.find((i) => i.id === itemId);
  if (prev) {
    await upsertLocalCacheItem({ ...prev, last_used_at: now });
  }
  try {
    const touched = await vaultCall("vault.touch", {
      subject_kind: "user",
      id: itemId,
    });
    const sealed =
      prev?.secrets_enc && prev.dek_wrapped
        ? { secrets_enc: prev.secrets_enc, dek_wrapped: prev.dek_wrapped }
        : {};
    await upsertLocalCacheItem({ ...toCachedMeta(touched.item), ...sealed });
  } catch {
    /* 本地乐观更新已生效；下次 list/unlock 会与 Habitat 对齐 */
  }
}

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: "fa-fill-username",
        title: "填充用户名",
        contexts: ["editable"],
      });
      chrome.contextMenus.create({
        id: "fa-fill-password",
        title: "填充密码",
        contexts: ["editable"],
      });
      chrome.contextMenus.create({
        id: "fa-fill-totp",
        title: "填充 TOTP",
        contexts: ["editable"],
      });
      chrome.contextMenus.create({
        id: "fa-generate-password",
        title: "生成密码并填入",
        contexts: ["editable"],
      });
      chrome.contextMenus.create({
        id: "fa-fill-card",
        title: "填充卡片",
        contexts: ["editable", "page"],
      });
      chrome.contextMenus.create({
        id: "fa-fill-identity",
        title: "填充身份",
        contexts: ["editable", "page"],
      });
    });
  });

  chrome.commands.onCommand.addListener((command) => {
    void (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url) return;
      if (command === "open-popup") {
        await chrome.action.openPopup().catch(() => undefined);
        return;
      }
      if (command === "generate-password") {
        const password = generatePassword({ length: 20, symbols: true });
        await chrome.tabs.sendMessage(tab.id, { type: "fill_password_only", password });
        return;
      }
      if (command === "autofill-login") {
        const res = await handleMessage({ type: "list_for_tab", tab_url: tab.url });
        if (!res.ok || !("items" in res) || res.items.length === 0) return;
        const first = res.items.find((i) => i.matched) ?? res.items[0];
        if (!first) return;
        const fillRes = await handleMessage({ type: "get_fill_payload", item_id: first.id });
        if (!fillRes.ok || !("fill" in fillRes)) return;
        await chrome.tabs.sendMessage(tab.id, { type: "fill_login", fill: fillRes.fill });
        void recordFillUsed(first.id);
      }
    })();
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    void (async () => {
      if (!tab?.id || !tab.url) return;
      if (info.menuItemId === "fa-generate-password") {
        const password = generatePassword({ length: 20, symbols: true });
        await chrome.tabs.sendMessage(tab.id, { type: "fill_password_only", password });
        return;
      }
      const listRes = await handleMessage({ type: "list_for_tab", tab_url: tab.url });
      if (!listRes.ok || !("items" in listRes) || listRes.items.length === 0) return;
      const preferType =
        info.menuItemId === "fa-fill-card"
          ? "card"
          : info.menuItemId === "fa-fill-identity"
            ? "identity"
            : "login";
      const item =
        listRes.items.find((i) => i.matched && i.item_type === preferType) ??
        listRes.items.find((i) => i.matched) ??
        listRes.items.find((i) => i.item_type === preferType) ??
        listRes.items[0];
      if (!item) return;
      const fillRes = await handleMessage({ type: "get_fill_payload", item_id: item.id });
      if (!fillRes.ok || !("fill" in fillRes)) return;
      const fill = fillRes.fill;
      if (info.menuItemId === "fa-fill-username") {
        await chrome.tabs.sendMessage(tab.id, {
          type: "fill_field",
          value: fill.username ?? "",
        });
        void recordFillUsed(item.id);
        return;
      }
      if (info.menuItemId === "fa-fill-password") {
        await chrome.tabs.sendMessage(tab.id, {
          type: "fill_field",
          value: fill.password ?? "",
        });
        void recordFillUsed(item.id);
        return;
      }
      if (info.menuItemId === "fa-fill-totp") {
        await chrome.tabs.sendMessage(tab.id, {
          type: "fill_field",
          value: fill.totp ?? "",
        });
        void recordFillUsed(item.id);
        return;
      }
      if (info.menuItemId === "fa-fill-card") {
        await chrome.tabs.sendMessage(tab.id, { type: "fill_card", fill });
        void recordFillUsed(item.id);
        return;
      }
      if (info.menuItemId === "fa-fill-identity") {
        await chrome.tabs.sendMessage(tab.id, { type: "fill_identity", fill });
        void recordFillUsed(item.id);
        return;
      }
    })();
  });

  chrome.runtime.onMessage.addListener((message: ExtToBgMessage, _sender, sendResponse) => {
    void handleMessage(message).then(sendResponse);
    return true;
  });
});

async function handleMessage(message: ExtToBgMessage): Promise<ExtBgResponse> {
  try {
    await ensureExtVaultSession();
    switch (message.type) {
      case "ping":
        return { ok: true, message: "pong" };
      case "get_status": {
        const settings = await loadSettings();
        return {
          ok: true,
          unlocked: await isExtVaultUnlocked(),
          habitat_configured: Boolean(settings.habitat_url && settings.auth_token),
        };
      }
      case "test_connection": {
        await vaultCall("vault.crypto.get", { subject_kind: "user" });
        return { ok: true, message: "连接成功" };
      }
      case "unlock": {
        const cryptoRes = await vaultCall("vault.crypto.get", { subject_kind: "user" });
        const config = cryptoRes.config;
        if (!config?.salt || !config.verifier) {
          return { ok: false, error: "用户保险库尚未初始化（请先在 /vault 设置主密码）" };
        }
        await getExtVaultSession().unlock({
          masterPassword: message.master_password,
          salt: config.salt,
          verifier: config.verifier,
          conversationId: EXT_SCOPE,
        });
        await persistExtVaultSession();
        try {
          await refreshLocalCacheFromHabitat();
        } catch {
          /* 缓存预热失败不阻断解锁 */
        }
        return {
          ok: true,
          unlocked: true,
          habitat_configured: true,
        };
      }
      case "lock": {
        getExtVaultSession().lock();
        await clearPersistedExtVaultSession();
        clearLocalCacheMemory();
        return {
          ok: true,
          unlocked: false,
          habitat_configured: true,
        };
      }
      case "list_for_tab": {
        if (!(await isExtVaultUnlocked())) return { ok: false, error: "vault_locked" };
        getExtVaultSession().touchActivity();
        const query = message.query?.trim() ?? "";
        const items = await listItemsPreferCache(query);
        const matchable = items.map((i) => ({
          id: i.id,
          ...(i.url !== undefined ? { url: i.url } : {}),
          ...(i.uris !== undefined ? { uris: i.uris } : {}),
          ...(i.last_used_at !== undefined ? { last_used_at: i.last_used_at } : {}),
        }));
        const ranked = matchVaultItemsForUrl(message.tab_url, matchable);
        const matchedIds = new Set(ranked.map((r) => r.id));
        const matched = ranked
          .map((r) => items.find((i) => i.id === r.id))
          .filter((i): i is NonNullable<typeof i> => i != null)
          .map((i) => ({ ...i, matched: true as const }));
        const rest = items
          .filter((i) => !matchedIds.has(i.id))
          .toSorted((a, b) => a.title.localeCompare(b.title) || a.id - b.id)
          .map((i) => ({ ...i, matched: false as const }));
        return { ok: true, items: [...matched, ...rest] };
      }
      case "get_fill_payload": {
        if (!(await isExtVaultUnlocked())) return { ok: false, error: "vault_locked" };
        getExtVaultSession().touchActivity();
        const cached = await loadLocalCache();
        const cachedItem = cached?.items.find((i) => i.id === message.item_id);
        let item: {
          id: number;
          title: string;
          item_type: string;
          username?: string;
          secrets_enc?: string;
          dek_wrapped?: string;
        };
        if (cachedItem?.secrets_enc && cachedItem.dek_wrapped) {
          item = cachedItem;
        } else {
          const got = await vaultCall("vault.get", {
            subject_kind: "user",
            id: message.item_id,
            include_secrets: true,
          });
          item = got.item;
          if (got.item.secrets_enc && got.item.dek_wrapped) {
            await upsertLocalCacheItem({
              ...toCachedMeta(got.item),
              secrets_enc: got.item.secrets_enc,
              dek_wrapped: got.item.dek_wrapped,
            });
          }
        }
        if (!item.secrets_enc || !item.dek_wrapped) {
          return { ok: false, error: "缺少密文" };
        }
        const secrets = await getExtVaultSession().openSecrets(item.secrets_enc, item.dek_wrapped);
        const totpRaw = typeof secrets.totp === "string" ? secrets.totp : undefined;
        const totpCode = totpRaw ? generateTotpCode(totpRaw)?.code : undefined;
        const fill: FillPayload = {
          item_id: item.id,
          title: item.title,
          item_type: item.item_type,
          ...(item.username ? { username: item.username } : {}),
          ...(typeof secrets.password === "string" ? { password: secrets.password } : {}),
          ...(totpCode ? { totp: totpCode } : {}),
          ...(secrets.card ? { card: secrets.card } : {}),
          ...(secrets.identity ? { identity: secrets.identity } : {}),
        };
        return { ok: true, fill };
      }
      case "record_fill_used": {
        if (!(await isExtVaultUnlocked())) return { ok: false, error: "vault_locked" };
        getExtVaultSession().touchActivity();
        await recordFillUsed(message.item_id);
        return { ok: true, recorded: true };
      }
      case "check_login": {
        if (!(await isExtVaultUnlocked())) return { ok: false, error: "vault_locked" };
        getExtVaultSession().touchActivity();
        const items = await listItemsPreferCache("");
        const match = findExistingLogin(items, message.url, message.username);
        return { ok: true, exists: Boolean(match) };
      }
      case "get_item": {
        if (!(await isExtVaultUnlocked())) return { ok: false, error: "vault_locked" };
        const { item } = await vaultCall("vault.get", {
          subject_kind: "user",
          id: message.item_id,
          include_secrets: true,
        });
        let password = "";
        let notes = "";
        let totp = "";
        let custom_fields: VaultCustomField[] = [];
        if (item.secrets_enc && item.dek_wrapped) {
          const secrets = await getExtVaultSession().openSecrets(
            item.secrets_enc,
            item.dek_wrapped,
          );
          password = typeof secrets.password === "string" ? secrets.password : "";
          notes = typeof secrets.notes === "string" ? secrets.notes : "";
          totp = typeof secrets.totp === "string" ? secrets.totp : "";
          if (Array.isArray(secrets.custom_fields)) {
            custom_fields = secrets.custom_fields
              .filter(
                (f): f is VaultCustomField =>
                  !!f &&
                  typeof f === "object" &&
                  typeof f.name === "string" &&
                  typeof f.value === "string",
              )
              .map((f) => ({
                name: f.name,
                value: f.value,
                type: f.type === "hidden" || f.type === "boolean" ? f.type : "text",
              }));
          }
        }
        const uris =
          item.uris && item.uris.length > 0
            ? item.uris
            : item.url
              ? [{ uri: item.url, match: "domain" as const }]
              : [];
        return {
          ok: true,
          editor: {
            id: item.id,
            title: item.title,
            item_type: item.item_type,
            username: item.username ?? "",
            url: item.url ?? uris[0]?.uri ?? "",
            uris,
            tag_ids: item.tag_ids ?? [],
            content: item.content ?? "",
            password,
            notes,
            totp,
            custom_fields,
          },
        };
      }
      case "save_item": {
        if (!(await isExtVaultUnlocked())) return { ok: false, error: "vault_locked" };
        const title = message.title.trim();
        if (!title) return { ok: false, error: "标题不能为空" };
        const uris = (message.uris ?? [])
          .map((u) => ({ uri: u.uri.trim(), match: u.match }))
          .filter((u) => u.uri.length > 0);
        const url = (message.url?.trim() || uris[0]?.uri || undefined) as string | undefined;
        const username = message.username?.trim() || undefined;
        const tag_ids = message.tag_ids ?? [];
        const content = message.content?.trim() || undefined;

        if (message.id != null) {
          const { item } = await vaultCall("vault.get", {
            subject_kind: "user",
            id: message.id,
            include_secrets: true,
          });
          let secrets: VaultSecretsPayload = {};
          if (item.secrets_enc && item.dek_wrapped) {
            secrets = await getExtVaultSession().openSecrets(item.secrets_enc, item.dek_wrapped);
          }
          if (message.password !== undefined) secrets.password = message.password;
          if (message.notes !== undefined) secrets.notes = message.notes;
          if (message.totp !== undefined) {
            const t = message.totp.trim();
            if (t) secrets.totp = t;
            else delete secrets.totp;
          }
          if (message.custom_fields !== undefined) {
            if (message.custom_fields.length > 0) secrets.custom_fields = message.custom_fields;
            else delete secrets.custom_fields;
          }
          const sealed = await getExtVaultSession().sealSecrets(secrets);
          const patched = await vaultCall("vault.patch", {
            subject_kind: "user",
            id: message.id,
            title,
            item_type: message.item_type,
            ...(url !== undefined ? { url } : {}),
            uris,
            ...(username !== undefined ? { username } : { username: "" }),
            tag_ids,
            ...(content !== undefined ? { content } : {}),
            secrets_enc: sealed.secrets_enc,
            dek_wrapped: sealed.dek_wrapped,
            custom_field_names: extractCustomFieldNames(secrets),
          });
          await upsertLocalCacheItem({
            ...toCachedMeta(patched.item),
            secrets_enc: sealed.secrets_enc,
            dek_wrapped: sealed.dek_wrapped,
          });
          return { ok: true, item: patched.item };
        }

        const secrets: VaultSecretsPayload = {};
        if (message.password) secrets.password = message.password;
        if (message.notes) secrets.notes = message.notes;
        if (message.totp?.trim()) secrets.totp = message.totp.trim();
        if (message.custom_fields?.length) secrets.custom_fields = message.custom_fields;
        const sealed = await getExtVaultSession().sealSecrets(secrets);
        const created = await vaultCall("vault.create", {
          subject_kind: "user",
          title,
          item_type: message.item_type,
          ...(url ? { url } : {}),
          uris,
          ...(username ? { username } : {}),
          tag_ids,
          ...(content ? { content } : {}),
          secrets_enc: sealed.secrets_enc,
          dek_wrapped: sealed.dek_wrapped,
          custom_field_names: extractCustomFieldNames(secrets),
        });
        await upsertLocalCacheItem({
          ...toCachedMeta(created.item),
          secrets_enc: sealed.secrets_enc,
          dek_wrapped: sealed.dek_wrapped,
        });
        return { ok: true, item: created.item };
      }
      case "delete_item": {
        if (!(await isExtVaultUnlocked())) return { ok: false, error: "vault_locked" };
        await vaultCall("vault.delete", {
          subject_kind: "user",
          id: message.item_id,
        });
        await removeLocalCacheItem(message.item_id);
        return { ok: true, deleted: true };
      }
      case "save_login": {
        if (!(await isExtVaultUnlocked())) return { ok: false, error: "vault_locked" };
        const items = await listItemsPreferCache("");
        const match = findExistingLogin(items, message.url, message.username);
        if (match) {
          const { item } = await vaultCall("vault.get", {
            subject_kind: "user",
            id: match.id,
            include_secrets: true,
          });
          let secrets: VaultSecretsPayload = { password: message.password };
          if (item.secrets_enc && item.dek_wrapped) {
            secrets = {
              ...(await getExtVaultSession().openSecrets(item.secrets_enc, item.dek_wrapped)),
              password: message.password,
            };
          }
          const sealed = await getExtVaultSession().sealSecrets(secrets);
          const baseUris =
            item.uris && item.uris.length > 0
              ? [...item.uris]
              : item.url
                ? [{ uri: item.url, match: "domain" as const }]
                : [];
          const uris = baseUris.some((u) => u.uri === message.url)
            ? baseUris
            : [...baseUris, { uri: message.url, match: "domain" as const }];
          const patched = await vaultCall("vault.patch", {
            subject_kind: "user",
            id: match.id,
            title: message.title || match.title,
            url: item.url || message.url,
            uris,
            username: message.username,
            secrets_enc: sealed.secrets_enc,
            dek_wrapped: sealed.dek_wrapped,
            custom_field_names: extractCustomFieldNames(secrets),
          });
          await upsertLocalCacheItem({
            ...toCachedMeta(patched.item),
            secrets_enc: sealed.secrets_enc,
            dek_wrapped: sealed.dek_wrapped,
          });
          return { ok: true, item: patched.item };
        }
        const secrets = { password: message.password };
        const sealed = await getExtVaultSession().sealSecrets(secrets);
        const uris = [{ uri: message.url, match: "domain" as const }];
        const created = await vaultCall("vault.create", {
          subject_kind: "user",
          title: message.title || new URL(message.url).hostname || "Login",
          item_type: "login",
          url: message.url,
          uris,
          username: message.username,
          secrets_enc: sealed.secrets_enc,
          dek_wrapped: sealed.dek_wrapped,
          custom_field_names: extractCustomFieldNames(secrets),
        });
        await upsertLocalCacheItem({
          ...toCachedMeta(created.item),
          secrets_enc: sealed.secrets_enc,
          dek_wrapped: sealed.dek_wrapped,
        });
        return { ok: true, item: created.item };
      }
      case "generate_password": {
        return {
          ok: true,
          password: generatePassword({
            length: message.length ?? 20,
            ...(message.upper !== undefined ? { upper: message.upper } : {}),
            ...(message.lower !== undefined ? { lower: message.lower } : {}),
            ...(message.digits !== undefined ? { digits: message.digits } : {}),
            symbols: message.symbols ?? true,
          }),
        };
      }
      default: {
        const _exhaustive: never = message;
        return { ok: false, error: `unknown message: ${JSON.stringify(_exhaustive)}` };
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
