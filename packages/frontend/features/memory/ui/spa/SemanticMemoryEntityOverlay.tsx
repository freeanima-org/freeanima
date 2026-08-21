import { useEffect, useState, type JSX } from "react";
import { Spinner } from "@freeanima/ui-kit";
import { EntityIdLabel } from "@freeanima/ui-kit/composite";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

import type { EntityOverlayProps } from "@freeanima/client/portal-sdk/entity-overlay-registry.ts";
import { asRecord } from "@freeanima/shared/util";

type SemanticMemoryView = {
  id: number;
  type: string;
  content: string;
  pinned: boolean;
  status: string;
  reference_count: number;
};

function memoryKindFromBody(body: Record<string, unknown> | undefined): string {
  const kind = body?.memory_kind;
  return typeof kind === "string" && kind.trim() ? kind : "semantic_memory";
}

function statusFromBody(body: Record<string, unknown> | undefined): string {
  const status = body?.status;
  return typeof status === "string" && status.trim() ? status : "active";
}

export function SemanticMemoryEntityOverlay({ id }: EntityOverlayProps): JSX.Element {
  const [row, setRow] = useState<SemanticMemoryView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getTypedHabitatClient()
      .call("entity.get", { id })
      .then((raw: unknown) => {
        if (cancelled) return;
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- RPC/加载器响应边界
        const item = (raw as { item?: Record<string, unknown> }).item;
        if (!item || item.primary_component !== "semantic_memory") {
          setError("未找到该语义记忆");
          setRow(null);
          return;
        }
        const body = asRecord(item.body ?? {}) ?? {};
        setRow({
          id: Number(item.id),
          type: memoryKindFromBody(body),
          content: typeof item.content === "string" ? item.content : "",
          pinned: item.pinned === true,
          status: statusFromBody(body),
          reference_count: typeof item.reference_count === "number" ? item.reference_count : 0,
        });
      })
      .catch((err: unknown) => {
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

  if (error || !row) {
    return (
      <div className="space-y-3 p-4 pr-10">
        <p className="text-sm text-destructive">{error ?? "未找到该语义记忆"}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex items-center gap-2 border-b px-4 py-2 pr-10">
        <EntityIdLabel id={row.id} animaComponent="semantic_memory" />
        <span className="text-xs text-muted-foreground">{row.type}</span>
        {row.pinned ? <span className="text-xs">📌</span> : null}
        <span className="text-xs text-muted-foreground">refs={row.reference_count}</span>
      </div>
      <div className="space-y-2 p-4">
        <p className="text-xs text-muted-foreground">status={row.status}</p>
        <p className="whitespace-pre-wrap text-sm">{row.content}</p>
      </div>
    </div>
  );
}
