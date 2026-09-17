import type { FillPayload } from "../../runtime/messages.ts";

export type VaultFillMessage = {
  type: string;
  fill?: FillPayload;
  password?: string;
  value?: string;
};

export type VaultFillDispatchDeps = {
  hasFocus: () => boolean;
  fillLogin: (fill: FillPayload) => void;
  fillActiveField: (value: string) => void;
  fillCard: (fill: FillPayload) => void;
  fillIdentity: (fill: FillPayload) => void;
};

/**
 * content script 填充消息分发。
 * `fill_field` / `fill_password_only` 仅在当前 frame 有焦点时写入（配合多 frame 广播）。
 */
export function dispatchVaultFillMessage(msg: VaultFillMessage, deps: VaultFillDispatchDeps): void {
  if (msg.type === "fill_login" && msg.fill) deps.fillLogin(msg.fill);
  if (msg.type === "fill_password_only" && msg.password) {
    if (!deps.hasFocus()) return;
    deps.fillActiveField(msg.password);
  }
  if (msg.type === "fill_field" && typeof msg.value === "string") {
    if (!deps.hasFocus()) return;
    deps.fillActiveField(msg.value);
  }
  if (msg.type === "fill_card" && msg.fill) deps.fillCard(msg.fill);
  if (msg.type === "fill_identity" && msg.fill) deps.fillIdentity(msg.fill);
}
