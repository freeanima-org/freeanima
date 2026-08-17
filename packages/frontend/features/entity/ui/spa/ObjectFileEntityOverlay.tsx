import { useEffect, useState, type JSX } from "react";
import { Spinner } from "@freeanima/ui-kit";
import { EntityIdLabel } from "@freeanima/ui-kit/composite";
import type { EntityOverlayProps } from "@freeanima/client/portal-sdk/entity-overlay-registry.ts";
import { OBJECT_FILE_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

import { ObjectFileMediaPanel } from "./components/ObjectFileMediaPanel.tsx";

type ObjectFileBasics = {
  title: string;
  mime_type: string;
  size: number | null;
};

function readObjectFileBody(body: Record<string, unknown> | undefined): {
  mime_type: string;
  size: number | null;
} {
  const mime =
    body && typeof body.mime_type === "string" && body.mime_type.trim()
      ? body.mime_type.trim()
      : "";
  const size =
    body && typeof body.size === "number" && Number.isFinite(body.size) && body.size >= 0
      ? body.size
      : null;
  return { mime_type: mime, size };
}

/** object_file 浮层：媒体预览 + 下载 */
export function ObjectFileEntityOverlay({ id }: EntityOverlayProps): JSX.Element {
  const [item, setItem] = useState<ObjectFileBasics | null>(null);
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
        if (row.primary_component !== OBJECT_FILE_COMPONENT) {
          setError("该实体不是 object_file");
          setItem(null);
          return;
        }
        const body = readObjectFileBody(row.body);
        setItem({
          title: row.title?.trim() || `object_file #${id}`,
          mime_type: body.mime_type,
          size: body.size,
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
        <p className="text-sm text-destructive">{error ?? "未找到该文件"}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex items-center gap-2 border-b px-4 py-2 pr-10">
        <EntityIdLabel id={id} animaComponent={OBJECT_FILE_COMPONENT} />
        <span className="text-xs text-muted-foreground">文件</span>
      </div>
      <div className="space-y-3 p-4 pr-10">
        <h2 className="text-base font-semibold break-words">{item.title}</h2>
        <ObjectFileMediaPanel
          objectFileId={id}
          title={item.title}
          {...(item.mime_type ? { mimeType: item.mime_type } : {})}
          {...(item.size != null ? { size: item.size } : {})}
        />
      </div>
    </div>
  );
}
