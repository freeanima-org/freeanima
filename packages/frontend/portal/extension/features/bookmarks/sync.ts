import type { BookmarkRowPayload } from "@freeanima/shared/rpc-contract/frames/bookmark.ts";
import { vaultCall, getExtUserSubjectId } from "../../runtime/habitat.ts";
import { markBookmarkEcho, pruneBookmarkEcho, shouldSuppressBookmarkEcho } from "./echo.ts";
import {
  clearBookmarkOutbox,
  enqueueBookmarkOutbox,
  loadBookmarkOutbox,
  type BookmarkOutboxItem,
} from "./outbox.ts";
import { loadBookmarkSyncSettings, saveBookmarkSyncSettings } from "./sync-settings.ts";

const ALARM_NAME = "freeanima.bookmark.sync";
const MAP_KEY = "freeanima.bookmark_id_map";

type IdMap = Record<string, number>; // browser_id -> entity_id

async function loadIdMap(): Promise<IdMap> {
  const data = await chrome.storage.local.get(MAP_KEY);
  const raw = data[MAP_KEY];
  return raw && typeof raw === "object" ? (raw as IdMap) : {};
}

async function saveIdMap(map: IdMap): Promise<void> {
  await chrome.storage.local.set({ [MAP_KEY]: map });
}

function nodeKind(node: chrome.bookmarks.BookmarkTreeNode): "folder" | "url" {
  return node.url == null ? "folder" : "url";
}

function toOutboxItem(
  node: chrome.bookmarks.BookmarkTreeNode,
  opts?: { deleted?: boolean },
): BookmarkOutboxItem {
  return {
    title: node.title ?? "",
    kind: nodeKind(node),
    url: node.url ?? null,
    parent_browser_id: node.parentId ?? null,
    sort_order: typeof node.index === "number" ? node.index : 0,
    browser_id: node.id,
    client_op_id: `chrome:${node.id}:${Date.now()}`,
    deleted: opts?.deleted,
  };
}

async function flushOutbox(): Promise<void> {
  const items = await loadBookmarkOutbox();
  if (items.length === 0) return;
  const map = await loadIdMap();
  for (let i = 0; i < items.length; i += 200) {
    const chunk = items.slice(i, i + 200);
    const res = await vaultCall("bookmark.upsert_batch", {
      subject_id: "user",
      items: chunk,
    });
    for (const row of res.items) {
      if (row.browser_id) {
        map[row.browser_id] = row.id;
        markBookmarkEcho(row.browser_id);
      }
    }
    await clearBookmarkOutbox(chunk.map((c) => c.browser_id));
  }
  await saveIdMap(map);
}

async function pushFullTree(): Promise<void> {
  const tree = await chrome.bookmarks.getTree();
  const flat: BookmarkOutboxItem[] = [];
  const walk = (nodes: chrome.bookmarks.BookmarkTreeNode[], parentId: string | null) => {
    nodes.forEach((node, index) => {
      // 跳过虚拟根；同步其子节点
      if (node.id === "0") {
        walk(node.children ?? [], null);
        return;
      }
      flat.push({
        title: node.title ?? "",
        kind: nodeKind(node),
        url: node.url ?? null,
        parent_browser_id: parentId,
        sort_order: typeof node.index === "number" ? node.index : index,
        browser_id: node.id,
        client_op_id: `chrome-full:${node.id}`,
      });
      if (node.children?.length) walk(node.children, node.id);
    });
  };
  walk(tree, null);
  for (const item of flat) await enqueueBookmarkOutbox(item);
  await flushOutbox();
}

async function applyRemoteRow(row: BookmarkRowPayload, map: IdMap): Promise<void> {
  const browserId = row.browser_id;
  if (!browserId) return;
  if (shouldSuppressBookmarkEcho(browserId)) return;

  if (row.deleted_at) {
    try {
      await chrome.bookmarks.removeTree(browserId);
    } catch {
      try {
        await chrome.bookmarks.remove(browserId);
      } catch {
        /* already gone */
      }
    }
    delete map[browserId];
    markBookmarkEcho(browserId);
    return;
  }

  const parentBrowserId = (() => {
    if (row.parent_id == null) return undefined;
    for (const [bid, eid] of Object.entries(map)) {
      if (eid === row.parent_id) return bid;
    }
    return undefined;
  })();

  try {
    await chrome.bookmarks.get(browserId);
    await chrome.bookmarks.update(browserId, {
      title: row.title,
      ...(row.kind === "url" ? { url: row.url ?? undefined } : {}),
    });
    if (parentBrowserId) {
      try {
        await chrome.bookmarks.move(browserId, {
          parentId: parentBrowserId,
          index: row.sort_order,
        });
      } catch {
        /* ignore move failures (e.g. root constraints) */
      }
    }
    markBookmarkEcho(browserId);
  } catch {
    // 本地不存在 → 创建
    const parentId = parentBrowserId ?? "1"; // 默认书签栏
    try {
      const created = await chrome.bookmarks.create({
        parentId,
        title: row.title,
        index: row.sort_order,
        ...(row.kind === "url" ? { url: row.url ?? "about:blank" } : {}),
      });
      // 新建后 browser_id 变了，回写 Habitat
      map[created.id] = row.id;
      markBookmarkEcho(created.id);
      await vaultCall("bookmark.patch", {
        subject_id: "user",
        id: row.id,
        browser_id: created.id,
        client_op_id: `chrome-bind:${created.id}`,
      });
      markBookmarkEcho(created.id);
    } catch (e) {
      throw e;
    }
  }
}

async function pullRemote(): Promise<void> {
  pruneBookmarkEcho();
  const settings = await loadBookmarkSyncSettings();
  const res = await vaultCall("bookmark.sync.pull", {
    subject_id: "user",
    ...(settings.last_pulled_updated_at ? { updated_after: settings.last_pulled_updated_at } : {}),
    limit: 2000,
  });
  const map = await loadIdMap();
  // 文件夹先
  const ordered = [...res.items].toSorted((a, b) => {
    if (a.kind === b.kind) return Date.parse(a.updated_at) - Date.parse(b.updated_at);
    return a.kind === "folder" ? -1 : 1;
  });
  let maxUpdated = settings.last_pulled_updated_at;
  for (const row of ordered) {
    if (row.browser_id) map[row.browser_id] = row.id;
    await applyRemoteRow(row, map);
    if (!maxUpdated || row.updated_at > maxUpdated) maxUpdated = row.updated_at;
  }
  await saveIdMap(map);
  await saveBookmarkSyncSettings({
    last_pulled_updated_at: maxUpdated,
    last_sync_at: new Date().toISOString(),
    last_error: null,
  });
}

export async function runBookmarkSync(opts?: { fullPush?: boolean }): Promise<{
  ok: true;
  message: string;
}> {
  const settings = await loadBookmarkSyncSettings();
  if (!settings.enabled) return { ok: true, message: "书签同步未开启" };
  try {
    if (opts?.fullPush || !settings.last_pulled_updated_at) {
      await pushFullTree();
    } else {
      await flushOutbox();
    }
    await pullRemote();
    return { ok: true, message: "书签已同步" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await saveBookmarkSyncSettings({ last_error: msg });
    throw e;
  }
}

export async function ensureBookmarkAlarm(): Promise<void> {
  const settings = await loadBookmarkSyncSettings();
  if (!settings.enabled) {
    await chrome.alarms.clear(ALARM_NAME);
    return;
  }
  await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 5 });
}

export function isBookmarkSyncAlarm(name: string): boolean {
  return name === ALARM_NAME;
}

export async function onBookmarkCreated(id: string, node: chrome.bookmarks.BookmarkTreeNode) {
  const settings = await loadBookmarkSyncSettings();
  if (!settings.enabled) return;
  markBookmarkEcho(id);
  await enqueueBookmarkOutbox(toOutboxItem({ ...node, id }));
  void flushOutbox().catch(() => undefined);
}

export async function onBookmarkChanged(id: string, _change: { title?: string; url?: string }) {
  const settings = await loadBookmarkSyncSettings();
  if (!settings.enabled) return;
  if (shouldSuppressBookmarkEcho(id)) return;
  const [node] = await chrome.bookmarks.get(id);
  if (!node) return;
  markBookmarkEcho(id);
  await enqueueBookmarkOutbox(toOutboxItem(node));
  void flushOutbox().catch(() => undefined);
}

export async function onBookmarkRemoved(
  id: string,
  removeInfo: { parentId: string; index: number; node: chrome.bookmarks.BookmarkTreeNode },
) {
  const settings = await loadBookmarkSyncSettings();
  if (!settings.enabled) return;
  if (shouldSuppressBookmarkEcho(id)) return;
  markBookmarkEcho(id);
  await enqueueBookmarkOutbox(
    toOutboxItem(
      {
        id,
        title: removeInfo.node.title ?? "",
        url: removeInfo.node.url,
        parentId: removeInfo.parentId,
        index: removeInfo.index,
      },
      { deleted: true },
    ),
  );
  void flushOutbox().catch(() => undefined);
}

export async function onBookmarkMoved(id: string) {
  const settings = await loadBookmarkSyncSettings();
  if (!settings.enabled) return;
  if (shouldSuppressBookmarkEcho(id)) return;
  const [node] = await chrome.bookmarks.get(id);
  if (!node) return;
  markBookmarkEcho(id);
  await enqueueBookmarkOutbox(toOutboxItem(node));
  void flushOutbox().catch(() => undefined);
}

export async function listLocalBookmarks(
  query?: string,
): Promise<{ id: string; title: string; url?: string; kind: "folder" | "url" }[]> {
  const q = query?.trim();
  if (q) {
    const hits = await chrome.bookmarks.search(q);
    return hits.map((n) => ({
      id: n.id,
      title: n.title ?? "",
      url: n.url,
      kind: nodeKind(n),
    }));
  }
  const tree = await chrome.bookmarks.getTree();
  const out: { id: string; title: string; url?: string; kind: "folder" | "url" }[] = [];
  const walk = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
    for (const n of nodes) {
      if (n.id !== "0") {
        out.push({ id: n.id, title: n.title ?? "", url: n.url, kind: nodeKind(n) });
      }
      if (n.children) walk(n.children);
    }
  };
  walk(tree);
  return out.slice(0, 500);
}
