import type {
  VaultItemDetailRowPayload,
  VaultItemMetaRowPayload,
} from "@freeanima/shared/rpc-contract";
import type { VaultSecretsPayload } from "@freeanima/shared/vault-crypto";

export type ExtToBgMessage =
  | { type: "ping" }
  | { type: "get_status" }
  | { type: "unlock"; master_password: string }
  | { type: "lock" }
  | { type: "list_for_tab"; tab_url: string }
  | { type: "get_fill_payload"; item_id: number }
  | { type: "save_login"; title: string; url: string; username: string; password: string }
  | {
      type: "generate_password";
      length?: number;
      upper?: boolean;
      lower?: boolean;
      digits?: boolean;
      symbols?: boolean;
    }
  | { type: "test_connection" };

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

export type ExtVaultListItem = VaultItemMetaRowPayload & { matched: boolean };

export type ExtBgResponse =
  | { ok: true; unlocked: boolean; habitat_configured: boolean }
  | { ok: true; items: ExtVaultListItem[] }
  | { ok: true; fill: FillPayload }
  | { ok: true; password: string }
  | { ok: true; item: VaultItemMetaRowPayload | VaultItemDetailRowPayload }
  | { ok: true; message: string }
  | { ok: false; error: string };

export function sendBg(msg: ExtToBgMessage): Promise<ExtBgResponse> {
  return chrome.runtime.sendMessage(msg) as Promise<ExtBgResponse>;
}
