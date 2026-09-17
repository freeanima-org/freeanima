import type {
  VaultItemDetailRowPayload,
  VaultItemMetaRowPayload,
  VaultUriEntryPayload,
  VaultUriMatch,
} from "@freeanima/shared/rpc-contract";
import type { VaultCustomField, VaultSecretsPayload } from "@freeanima/shared/vault-crypto";

export type VaultItemType = VaultItemMetaRowPayload["item_type"];

export type ExtToBgMessage =
  | { type: "ping" }
  | { type: "get_status" }
  | { type: "unlock"; master_password: string }
  | { type: "lock" }
  | { type: "list_for_tab"; tab_url: string; query?: string }
  | { type: "get_fill_payload"; item_id: number }
  | { type: "record_fill_used"; item_id: number }
  | { type: "get_item"; item_id: number }
  | {
      type: "save_item";
      id?: number;
      title: string;
      item_type: VaultItemType;
      username?: string;
      url?: string;
      uris?: VaultUriEntryPayload[];
      tag_ids?: number[];
      content?: string;
      password?: string;
      notes?: string;
      totp?: string;
      custom_fields?: VaultCustomField[];
    }
  | { type: "delete_item"; item_id: number }
  | { type: "save_login"; title: string; url: string; username: string; password: string }
  | { type: "check_login"; url: string; username: string; password?: string }
  | {
      type: "generate_password";
      length?: number;
      upper?: boolean;
      lower?: boolean;
      digits?: boolean;
      symbols?: boolean;
    }
  | { type: "test_connection" }
  | { type: "bookmark_get_sync_settings" }
  | { type: "bookmark_set_sync_enabled"; enabled: boolean }
  | { type: "bookmark_sync_now"; full?: boolean }
  | { type: "bookmark_list"; query?: string };

export type FillPayload = {
  item_id: number;
  title: string;
  username?: string;
  password?: string;
  totp?: string;
  item_type: string;
  card?: VaultSecretsPayload["card"];
  identity?: VaultSecretsPayload["identity"];
};

/** Popup 编辑器用：明文 secrets 已在 background 解开 */
export type ExtVaultEditorItem = {
  id?: number;
  title: string;
  item_type: VaultItemType;
  username: string;
  url: string;
  uris: VaultUriEntryPayload[];
  tag_ids: number[];
  content: string;
  password: string;
  notes: string;
  totp: string;
  custom_fields: VaultCustomField[];
};

export type ExtVaultListItem = VaultItemMetaRowPayload & { matched: boolean };

export type ExtVaultStatusOk = {
  ok: true;
  unlocked: boolean;
  habitat_configured: boolean;
  online: boolean;
  /** 本地已有 salt/verifier，可冷启动离线主密码解锁 */
  offline_unlock_ready: boolean;
};

export type ExtBgResponse =
  | ExtVaultStatusOk
  | { ok: true; items: ExtVaultListItem[] }
  | { ok: true; fill: FillPayload }
  | { ok: true; recorded: true }
  | { ok: true; editor: ExtVaultEditorItem }
  | { ok: true; password: string }
  | { ok: true; item: VaultItemMetaRowPayload | VaultItemDetailRowPayload }
  | { ok: true; message: string }
  | { ok: true; deleted: true }
  | { ok: true; exists: boolean; needs_password_update?: boolean }
  | {
      ok: true;
      bookmark_sync: {
        enabled: boolean;
        last_sync_at: string | null;
        last_error: string | null;
      };
    }
  | {
      ok: true;
      bookmarks: { id: string; title: string; url?: string; kind: "folder" | "url" }[];
    }
  | { ok: false; error: string };

export type { VaultUriEntryPayload, VaultUriMatch };

export function sendBg(msg: ExtToBgMessage): Promise<ExtBgResponse> {
  return chrome.runtime.sendMessage(msg) as Promise<ExtBgResponse>;
}
