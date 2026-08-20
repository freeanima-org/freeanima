import type { VaultItemMetaRowPayload } from "@freeanima/shared/rpc-contract";
import { matchVaultItemsForUrl } from "@freeanima/shared/vault-crypto/uri-match.ts";

/**
 * 与自动填充一致：login + URI 匹配（domain/host/…）+ username。
 * 避免库里是 `https://example.com`（domain）而当前页是 `/login` 时仍弹保存提示。
 */
export function findExistingLogin(
  items: Array<
    Pick<VaultItemMetaRowPayload, "id" | "item_type" | "url" | "uris" | "username" | "title">
  >,
  url: string,
  username: string,
): (typeof items)[number] | undefined {
  const wantUser = username;
  const candidates = items.filter(
    (i) => i.item_type === "login" && (i.username ?? "") === wantUser,
  );
  if (candidates.length === 0) return undefined;
  const ranked = matchVaultItemsForUrl(
    url,
    candidates.map((i) => ({
      id: i.id,
      ...(i.url !== undefined ? { url: i.url } : {}),
      ...(i.uris !== undefined ? { uris: i.uris } : {}),
    })),
  );
  const bestId = ranked[0]?.id;
  if (bestId == null) return undefined;
  return candidates.find((i) => i.id === bestId);
}

/**
 * 库内密码可解时：与表单密码不同则需提示更新。
 * 无密文可解时保守返回 false（不弹更新提示）。
 */
export function needsPasswordUpdate(
  storedPassword: string | undefined,
  formPassword: string,
): boolean {
  if (storedPassword === undefined) return false;
  return storedPassword !== formPassword;
}
