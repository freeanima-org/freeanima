import { HABITAT_RPC_REST_PREFIX } from "@freeanima/shared/habitat-rpc";
import { resolveHabitatApiOrigin } from "@freeanima/client/portal-sdk/habitat-api-origin.ts";
import type { DisplayItem } from "./types.ts";

export type ConversationShareSnapshotView = {
  id: string;
  conversation_id: string;
  scope: "full" | "selected";
  title?: string;
  display: DisplayItem[];
  created_at: string;
  expires_at: string;
};

/** 公开只读拉取（无需 Bearer） */
export async function fetchPublicConversationShare(
  shareId: string,
): Promise<ConversationShareSnapshotView> {
  const origin = resolveHabitatApiOrigin();
  const url = `${origin}${HABITAT_RPC_REST_PREFIX}/conversation/share/get/${encodeURIComponent(shareId)}`;
  const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const errMsg =
      body && typeof body === "object" && body !== null && "error" in body
        ? // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- RPC/加载器响应边界
          (body as { error?: { message?: string } }).error?.message
        : undefined;
    throw new Error(errMsg || text || `HTTP ${res.status}`);
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- RPC/加载器响应边界
  const result = body as ConversationShareSnapshotView | null;
  if (!result?.id || !Array.isArray(result.display)) {
    throw new Error("分享内容无效");
  }
  return result;
}
