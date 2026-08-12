import { useEffect, useState, type JSX } from "react";
import { Spinner } from "@freeanima/ui-kit";
import { EntityIdLabel } from "@freeanima/ui-kit/composite";
import type { EntityOverlayProps } from "@freeanima/client/portal-sdk/entity-overlay-registry.ts";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

type EntityBasics = {
  title: string;
  summary: string;
  content: string;
  type: string;
  primary_component: string | null;
  components: string[];
  world_id: number;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", { hour12: false });
}

function MetaRow({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words font-mono text-xs">{value}</span>
    </div>
  );
}

/**
 * 通用实体叠加层：仅展示基础字段（标题 / 摘要 / 正文 / 元数据）。
 * 无专用浮层或 primary_component 未知时使用。
 */
export function GenericEntityOverlay({ id, component }: EntityOverlayProps): JSX.Element {
  const [item, setItem] = useState<EntityBasics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getTypedHabitatClient()
      .call("entity.get", { id })
      .then((data) => {
        if (cancelled) return;
        const row = data.item;
        setItem({
          title: row.title?.trim() || "",
          summary: row.summary?.trim() || "",
          content: row.content?.trim() || "",
          type: row.type,
          primary_component: row.primary_component,
          components: row.components ?? [],
          world_id: row.world_id,
          pinned: row.pinned,
          created_at: row.created_at,
          updated_at: row.updated_at,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-48 items-center justify-center p-6">
        <Spinner className="size-5" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="space-y-3 p-4 pr-10">
        <p className="text-sm text-destructive">{error ?? "未找到该实体"}</p>
      </div>
    );
  }

  const heading = item.title || item.summary || `实体 #${id}`;
  const primary = item.primary_component?.trim() || component.trim() || undefined;
  const body = item.content && item.content !== item.summary ? item.content : item.content;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex items-center gap-2 border-b px-4 py-2 pr-10">
        <EntityIdLabel id={id} {...(primary ? { animaComponent: primary } : {})} />
        <span className="text-xs text-muted-foreground">{"实体"}</span>
      </div>
      <div className="space-y-4 p-4 pr-10">
        <h2 className="text-base font-semibold break-words">{heading}</h2>
        {item.summary && item.summary !== heading ? (
          <p className="text-sm text-muted-foreground break-words">{item.summary}</p>
        ) : null}
        {body ? <p className="whitespace-pre-wrap text-sm break-words">{body}</p> : null}
        <div className="space-y-1.5 border-t pt-3">
          <MetaRow label={"类型"} value={item.type} />
          <MetaRow label={"主组件"} value={primary ?? "—"} />
          <MetaRow label={"组件"} value={item.components.join(", ") || "—"} />
          <MetaRow label={"World"} value={String(item.world_id)} />
          <MetaRow label={"置顶"} value={item.pinned ? "是" : "否"} />
          <MetaRow label={"创建"} value={formatWhen(item.created_at)} />
          <MetaRow label={"更新"} value={formatWhen(item.updated_at)} />
        </div>
      </div>
    </div>
  );
}
