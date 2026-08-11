import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Spinner,
} from "@freeanima/ui-kit";
import type { SubjectKind } from "@freeanima/client/portal-sdk";

import { listVaultItemHistory, restoreVaultItemHistory } from "../lib/api.ts";

type HistoryRow = {
  index: number;
  captured_at: string;
  title: string;
  changed_fields: string[];
};

const CHANGED_FIELD_LABELS: Record<string, string> = {
  title: "标题",
  url: "网址",
  username: "用户名",
  tag_ids: "标签",
  content: "备注",
  item_type: "类型",
  custom_field_names: "自定义字段",
  secrets: "密文",
};

function formatChangedFields(fields: string[]): string {
  if (fields.length === 0) return "无字段变化";
  return fields.map((f) => CHANGED_FIELD_LABELS[f] ?? f).join("、");
}

function formatCapturedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function VaultItemHistoryDialog({
  open,
  subjectKind,
  itemId,
  itemTitle,
  disabled,
  onOpenChange,
  onRestored,
}: {
  open: boolean;
  subjectKind: SubjectKind;
  itemId: number;
  itemTitle: string;
  disabled?: boolean;
  onOpenChange: (open: boolean) => void;
  onRestored: () => void | Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [restoringIndex, setRestoringIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setConfirmIndex(null);
    void listVaultItemHistory(subjectKind, itemId)
      .then((revisions) => {
        if (!cancelled) setRows(revisions);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setRows([]);
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, subjectKind, itemId]);

  const confirmRow = confirmIndex === null ? null : rows.find((r) => r.index === confirmIndex);

  return (
    <>
      <Dialog
        isOpen={open}
        onOpenChange={onOpenChange}
        className="max-w-lg safe-area-pt safe-area-pb"
      >
        <DialogHeader>
          <DialogTitle>历史版本 — {itemTitle}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto py-2">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner className="size-5" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              暂无历史版本。编辑保存后会自动保留上一版。
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => (
                <li
                  key={row.index}
                  className="flex items-start justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium truncate">{row.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCapturedAt(row.captured_at)}
                    </p>
                    <p
                      className={
                        row.changed_fields.length > 0
                          ? "text-xs text-amber-700 dark:text-amber-400"
                          : "text-xs text-muted-foreground"
                      }
                    >
                      变更：{formatChangedFields(row.changed_fields)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    isDisabled={disabled || restoringIndex !== null}
                    onClick={() => setConfirmIndex(row.index)}
                  >
                    恢复
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog
        isOpen={confirmIndex !== null}
        onOpenChange={(next) => {
          if (!next) setConfirmIndex(null);
        }}
        className="max-w-md safe-area-pt safe-area-pb"
      >
        <DialogHeader>
          <DialogTitle>确认恢复此版本？</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground py-2">
          将用
          {confirmRow ? ` ${formatCapturedAt(confirmRow.captured_at)} 的快照` : "所选历史版本"}
          覆盖当前条目；当前内容会先进入历史。
        </p>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            isDisabled={restoringIndex !== null}
            onClick={() => setConfirmIndex(null)}
          >
            取消
          </Button>
          <Button
            type="button"
            isDisabled={restoringIndex !== null || confirmIndex === null}
            onClick={() => {
              if (confirmIndex === null) return;
              setRestoringIndex(confirmIndex);
              setError("");
              void restoreVaultItemHistory(subjectKind, itemId, confirmIndex)
                .then(async () => {
                  setConfirmIndex(null);
                  onOpenChange(false);
                  await onRestored();
                })
                .catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : String(err));
                })
                .finally(() => setRestoringIndex(null));
            }}
          >
            {restoringIndex !== null ? <Spinner className="size-4" /> : "确认恢复"}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
