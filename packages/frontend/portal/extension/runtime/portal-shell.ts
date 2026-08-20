import { buildShellApiFields } from "@freeanima/client/portal-sdk/shell-api-fields";
import type { ShellApi } from "@freeanima/client/portal-sdk/shell-api";
import { resolveHabitatRpcWsUrl } from "@freeanima/shared/habitat-rpc";

import type { VaultExtSettings } from "./settings.ts";

function stubInstanceStore(): ReturnType<ShellApi["createFileInstanceStore"]> {
  return {
    load: () => null,
    save: async () => {},
  };
}

/**
 * 把扩展 Habitat URL / Token 写入 `window.portalShell`。
 * TagPicker 等共享 UI 经 `getTypedHabitatClient()` 读 portalShell 鉴权；
 * 扩展若不注入，会落到默认 127.0.0.1:2658 且无 Bearer → Unauthorized。
 */
export function applyExtSettingsToPortalShell(settings: VaultExtSettings): void {
  if (typeof window === "undefined") return;

  const habitatUrl = settings.habitat_url.trim().replace(/\/$/, "");
  const token = settings.auth_token.trim();
  if (!habitatUrl) {
    window.portalShell = {
      habitatUrl: "",
      habitatWsUrl: "",
      createFileInstanceStore: stubInstanceStore,
    };
    return;
  }

  const habitatWsUrl = resolveHabitatRpcWsUrl(habitatUrl);
  const fields = buildShellApiFields(habitatUrl, habitatWsUrl, token);
  window.portalShell = {
    ...fields,
    createFileInstanceStore: stubInstanceStore,
  };
}
