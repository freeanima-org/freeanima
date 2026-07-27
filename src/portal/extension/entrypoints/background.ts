import { extractCustomFieldNames, generateTotpCode } from "@freeanima/shared/vault-crypto";
import type { VaultSecretsPayload } from "@freeanima/shared/vault-crypto";
import { matchVaultItemsForUrl } from "@freeanima/features/vault/domain/uri-match.ts";
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
        return;
      }
      if (info.menuItemId === "fa-fill-password") {
        await chrome.tabs.sendMessage(tab.id, {
          type: "fill_field",
          value: fill.password ?? "",
        });
        return;
      }
      if (info.menuItemId === "fa-fill-totp") {
        await chrome.tabs.sendMessage(tab.id, {
          type: "fill_field",
          value: fill.totp ?? "",
        });
        return;
      }
      if (info.menuItemId === "fa-fill-card") {
        await chrome.tabs.sendMessage(tab.id, { type: "fill_card", fill });
        return;
      }
      if (info.menuItemId === "fa-fill-identity") {
        await chrome.tabs.sendMessage(tab.id, { type: "fill_identity", fill });
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
        return {
          ok: true,
          unlocked: true,
          habitat_configured: true,
        };
      }
      case "lock": {
        getExtVaultSession().lock();
        await clearPersistedExtVaultSession();
        return {
          ok: true,
          unlocked: false,
          habitat_configured: true,
        };
      }
      case "list_for_tab": {
        if (!(await isExtVaultUnlocked())) return { ok: false, error: "vault_locked" };
        getExtVaultSession().touchActivity();
        const listed = await vaultCall("vault.list", {
          subject_kind: "user",
          limit: 2000,
        });
        const matchable = listed.items.map((i) => ({
          id: i.id,
          ...(i.url !== undefined ? { url: i.url } : {}),
          ...(i.uris !== undefined ? { uris: i.uris } : {}),
        }));
        const ranked = matchVaultItemsForUrl(message.tab_url, matchable);
        const matchedIds = new Set(ranked.map((r) => r.id));
        const matched = ranked
          .map((r) => listed.items.find((i) => i.id === r.id))
          .filter((i): i is NonNullable<typeof i> => i != null)
          .map((i) => ({ ...i, matched: true as const }));
        const rest = listed.items
          .filter((i) => !matchedIds.has(i.id))
          .toSorted((a, b) => a.title.localeCompare(b.title) || a.id - b.id)
          .map((i) => ({ ...i, matched: false as const }));
        return { ok: true, items: [...matched, ...rest] };
      }
      case "get_fill_payload": {
        if (!(await isExtVaultUnlocked())) return { ok: false, error: "vault_locked" };
        const { item } = await vaultCall("vault.get", {
          subject_kind: "user",
          id: message.item_id,
          include_secrets: true,
        });
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
        if (item.secrets_enc && item.dek_wrapped) {
          const secrets = await getExtVaultSession().openSecrets(
            item.secrets_enc,
            item.dek_wrapped,
          );
          password = typeof secrets.password === "string" ? secrets.password : "";
          notes = typeof secrets.notes === "string" ? secrets.notes : "";
          totp = typeof secrets.totp === "string" ? secrets.totp : "";
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
            tags: item.tags ?? [],
            content: item.content ?? "",
            password,
            notes,
            totp,
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
        const tags = (message.tags ?? []).map((t) => t.trim()).filter(Boolean);
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
          const sealed = await getExtVaultSession().sealSecrets(secrets);
          const patched = await vaultCall("vault.patch", {
            subject_kind: "user",
            id: message.id,
            title,
            item_type: message.item_type,
            ...(url !== undefined ? { url } : {}),
            uris,
            ...(username !== undefined ? { username } : { username: "" }),
            tags,
            ...(content !== undefined ? { content } : {}),
            secrets_enc: sealed.secrets_enc,
            dek_wrapped: sealed.dek_wrapped,
            custom_field_names: extractCustomFieldNames(secrets),
          });
          return { ok: true, item: patched.item };
        }

        const secrets: VaultSecretsPayload = {};
        if (message.password) secrets.password = message.password;
        if (message.notes) secrets.notes = message.notes;
        if (message.totp?.trim()) secrets.totp = message.totp.trim();
        const sealed = await getExtVaultSession().sealSecrets(secrets);
        const created = await vaultCall("vault.create", {
          subject_kind: "user",
          title,
          item_type: message.item_type,
          ...(url ? { url } : {}),
          uris,
          ...(username ? { username } : {}),
          tags,
          ...(content ? { content } : {}),
          secrets_enc: sealed.secrets_enc,
          dek_wrapped: sealed.dek_wrapped,
          custom_field_names: extractCustomFieldNames(secrets),
        });
        return { ok: true, item: created.item };
      }
      case "delete_item": {
        if (!(await isExtVaultUnlocked())) return { ok: false, error: "vault_locked" };
        await vaultCall("vault.delete", {
          subject_kind: "user",
          id: message.item_id,
        });
        return { ok: true, deleted: true };
      }
      case "save_login": {
        if (!(await isExtVaultUnlocked())) return { ok: false, error: "vault_locked" };
        const listed = await vaultCall("vault.list", {
          subject_kind: "user",
          limit: 2000,
        });
        const match = listed.items.find(
          (i) =>
            i.item_type === "login" &&
            (i.url === message.url || i.uris?.some((u) => u.uri === message.url)) &&
            (i.username ?? "") === message.username,
        );
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
