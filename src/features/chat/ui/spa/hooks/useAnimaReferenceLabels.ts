import { useEffect, useMemo, useState } from "react";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

import type { DisplayItem } from "../lib/types.ts";

const MARKER_RE = /\[\[anima:(\d+)(?:\?[^\]]*)?\]\]/gi;

/** 进程级摘要缓存（id → snippet；空串表示已查过但无可用文案） */
const snippetCache = new Map<number, string>();
const inflight = new Map<number, Promise<void>>();

export function parseAnimaReferenceIds(content: string): number[] {
  if (!content.trim()) return [];
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const match of content.matchAll(MARKER_RE)) {
    const raw = match[1];
    if (!raw) continue;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/** title 优先，否则 content；按 Unicode 字截到最多 10 字 */
export function snippetFromEntityFields(title: string, content: string): string {
  const raw = title.trim() || content.trim();
  if (!raw) return "";
  return [...raw].slice(0, 10).join("");
}

function collectIdsFromDisplay(display: DisplayItem[], streamText: string): number[] {
  const seen = new Set<number>();
  const ids: number[] = [];
  const push = (text: string) => {
    for (const id of parseAnimaReferenceIds(text)) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  };
  for (const item of display) {
    if (item.type === "message" && typeof item.content === "string") {
      push(item.content);
    }
  }
  if (streamText) push(streamText);
  return ids;
}

async function fetchSnippet(id: number): Promise<void> {
  if (snippetCache.has(id)) return;
  const existing = inflight.get(id);
  if (existing) {
    await existing;
    return;
  }
  const p = (async () => {
    try {
      const data = await getTypedHabitatClient().call("entity.get", { id });
      snippetCache.set(id, snippetFromEntityFields(data.item.title ?? "", data.item.content ?? ""));
    } catch {
      snippetCache.set(id, "");
    } finally {
      inflight.delete(id);
    }
  })();
  inflight.set(id, p);
  await p;
}

/**
 * 非阻塞：首帧 labels 可为空（chip 仅 #id）；后台 entity.get 补摘要后更新 Map。
 */
export function useAnimaReferenceLabels(
  display: DisplayItem[],
  streamText = "",
): ReadonlyMap<number, string> {
  const ids = useMemo(() => collectIdsFromDisplay(display, streamText), [display, streamText]);
  const [labels, setLabels] = useState<ReadonlyMap<number, string>>(() => {
    const initial = new Map<number, string>();
    for (const id of ids) {
      const cached = snippetCache.get(id);
      if (cached) initial.set(id, cached);
    }
    return initial;
  });

  useEffect(() => {
    let cancelled = false;

    const applyCached = () => {
      setLabels((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const id of ids) {
          const cached = snippetCache.get(id);
          if (!cached) continue;
          if (next.get(id) === cached) continue;
          next.set(id, cached);
          changed = true;
        }
        return changed ? next : prev;
      });
    };

    applyCached();

    const missing = ids.filter((id) => !snippetCache.has(id));
    if (missing.length === 0) return;

    void Promise.all(missing.map((id) => fetchSnippet(id))).then(() => {
      if (!cancelled) applyCached();
    });

    return () => {
      cancelled = true;
    };
  }, [ids]);

  return labels;
}

/** 测试用：清空进程缓存 */
export function resetAnimaReferenceLabelCacheForTests(): void {
  snippetCache.clear();
  inflight.clear();
}
