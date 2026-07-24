import { useEffect, useState, type JSX } from "react";
import { Spinner } from "@freeanima/frontend/ui-kit";
import { EntityIdLabel } from "@freeanima/frontend/ui-kit/composite";
import { getTypedHabitatClient } from "@freeanima/platform/habitat/client.ts";

import type { EntityOverlayProps } from "@freeanima/frontend/app-ui/spa/features/entity-overlay-registry.ts";

type SemanticMemoryView = {
  id: number;
  type: string;
  content: string;
  pinned: boolean;
  status: string;
  reference_count: number;
};

export function SemanticMemoryEntityOverlay({ id }: EntityOverlayProps): JSX.Element {
  const [row, setRow] = useState<SemanticMemoryView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getTypedHabitatClient()
      .call("memory.semanticList", {
        status: "all",
        limit: 100,
        offset: 0,
      })
      .then((raw: unknown) => {
        if (cancelled) return;
        const items = (raw as { items?: SemanticMemoryView[] }).items ?? [];
        const hit = items.find((item) => item.id === id) ?? null;
        if (!hit) {
          setError("未找到该语义记忆");
          setRow(null);
        } else {
          setRow(hit);
        }
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
