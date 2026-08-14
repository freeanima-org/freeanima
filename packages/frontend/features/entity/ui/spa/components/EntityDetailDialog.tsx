import { useEffect, useState, type ReactNode } from "react";
import {
  Button,
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Spinner,
} from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { formatDateTime } from "@freeanima/ui-kit/lib/datetime-local.ts";

import { fetchEntityDetail, type EntityDetail } from "../lib/api.ts";

type EntityDetailDialogProps = {
  open: boolean;
  entityId: number | null;
  /** 回收站行需 include_deleted */
  includeDeleted?: boolean;
  onClose: () => void;
};

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="text-muted-foreground text-xs font-medium">{label}</div>
      <div className="text-sm break-words">{children}</div>
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  let text: string;
  try {
    text = JSON.stringify(value, null, 2);
  } catch {
    text = String(value);
  }
  if (!text || text === "{}" || text === "[]") {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <pre className="bg-muted/40 max-h-64 overflow-auto rounded-md border p-2 font-mono text-xs whitespace-pre-wrap">
      {text}
    </pre>
  );
}

function TextBlock({ value }: { value: string }) {
  const trimmed = value.trim();
  if (!trimmed) return <span className="text-muted-foreground">—</span>;
  return (
    <pre className="bg-muted/40 max-h-64 overflow-auto rounded-md border p-2 text-xs whitespace-pre-wrap">
      {value}
    </pre>
  );
}

export function EntityDetailDialog({
  open,
  entityId,
  includeDeleted = false,
  onClose,
}: EntityDetailDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [item, setItem] = useState<EntityDetail | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || entityId == null) {
      setItem(null);
      setError("");
      setCopied(false);
      return () => {};
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    setItem(null);
    void fetchEntityDetail(entityId, { includeDeleted })
      .then((detail) => {
        if (!cancelled) setItem(detail);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, entityId, includeDeleted]);

  const copyUri = async () => {
    if (entityId == null) return;
    try {
      await navigator.clipboard.writeText(`anima:${entityId}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("复制失败");
    }
  };

  return (
    <Dialog
      isOpen={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      className="max-w-2xl"
    >
      <DialogHeader>
        <DialogTitle>
          {item
            ? item.title.trim() || `实体 #${item.id}`
            : entityId != null
              ? `实体 #${entityId}`
              : "实体详情"}
        </DialogTitle>
      </DialogHeader>

      <div className="max-h-[70vh] space-y-4 overflow-y-auto py-2">
        {error ? <StatusAlert variant="error">{error}</StatusAlert> : null}
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="size-6" />
          </div>
        ) : item ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailField label="ID">#{item.id}</DetailField>
              <DetailField label="Anima URI">
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => void copyUri()}
                >
                  anima:{item.id}
                  {copied ? (
                    <span className="text-muted-foreground ml-2 text-xs">已复制</span>
                  ) : null}
                </button>
              </DetailField>
              <DetailField label="类型">{item.type}</DetailField>
              <DetailField label="World">#{item.world_id}</DetailField>
              <DetailField label="主组件">{item.primary_component ?? "—"}</DetailField>
              <DetailField label="组件">
                {item.components.length > 0 ? item.components.join(", ") : "—"}
              </DetailField>
              <DetailField label="置顶">{item.pinned ? "是" : "否"}</DetailField>
              <DetailField label="引用权重">{item.reference_count}</DetailField>
              <DetailField label="标签 ID">
                {item.tag_ids.length > 0 ? item.tag_ids.join(", ") : "—"}
              </DetailField>
              <DetailField label="版本数">{item.revision_count}</DetailField>
              <DetailField label="创建">{formatDateTime(item.created_at)}</DetailField>
              <DetailField label="更新">{formatDateTime(item.updated_at)}</DetailField>
              {item.deleted_at ? (
                <DetailField label="删除">{formatDateTime(item.deleted_at)}</DetailField>
              ) : null}
            </div>
            <DetailField label="摘要">
              <TextBlock value={item.summary} />
            </DetailField>
            <DetailField label="正文">
              <TextBlock value={item.content} />
            </DetailField>
            <DetailField label="Body">
              <JsonBlock value={item.body} />
            </DetailField>
          </>
        ) : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          关闭
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
