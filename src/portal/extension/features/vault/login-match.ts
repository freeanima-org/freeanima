import type { VaultItemMetaRowPayload } from "@freeanima/shared/rpc-contract";

/** 与 save_login 一致：login + url（主 url 或 uris）精确匹配 + username */
export function findExistingLogin(
  items: Array<Pick<VaultItemMetaRowPayload, "id" | "item_type" | "url" | "uris" | "username">>,
  url: string,
  username: string,
): (typeof items)[number] | undefined {
  return items.find(
    (i) =>
      i.item_type === "login" &&
      (i.url === url || i.uris?.some((u) => u.uri === url)) &&
      (i.username ?? "") === username,
  );
}
