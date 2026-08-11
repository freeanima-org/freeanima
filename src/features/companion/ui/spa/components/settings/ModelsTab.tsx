import { useEffect, useState, type ChangeEvent } from "react";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Spinner,
  buttonVariants,
  cn,
} from "@freeanima/ui-kit";
import { showConfirm } from "@freeanima/ui-kit/composite";
import {
  deleteModel,
  renameModel,
  reorderModels,
  setActiveModel,
} from "@freeanima/features/companion/ui/spa/lib/api.ts";
import { useCompanionStore } from "@freeanima/features/companion/ui/spa/stores/companion.ts";
import {
  emitConfigChanged,
  listenCompanionModelStatus,
} from "@freeanima/features/companion/ui/spa/lib/portal-shell.ts";

export function ModelsTab() {
  const models = useCompanionStore((s) => s.models);
  const activeObjectFileId = useCompanionStore((s) => s.activeObjectFileId);
  const uploadModel = useCompanionStore((s) => s.uploadModel);
  const refreshConfig = useCompanionStore((s) => s.refreshConfig);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [desktopLoading, setDesktopLoading] = useState(false);
  const [desktopError, setDesktopError] = useState<string | null>(null);

  useEffect(() => {
    let off: (() => void) | undefined;
    void listenCompanionModelStatus((status) => {
      setDesktopLoading(status.loading);
      setDesktopError(status.error);
      if (status.error) {
        setError(status.error);
      }
    }).then((fn) => {
      off = fn;
    });
    return () => off?.();
  }, []);

  const moveModel = async (objectFileId: number, delta: -1 | 1): Promise<void> => {
    const ids = models.map((m) => m.object_file_id);
    const idx = ids.indexOf(objectFileId);
    const swap = idx + delta;
    if (idx < 0 || swap < 0 || swap >= ids.length) return;
    const next = [...ids];
    const a = next[idx];
    const b = next[swap];
    if (a == null || b == null) return;
    next[idx] = b;
    next[swap] = a;
    await reorderModels(next);
    await refreshConfig();
  };

  const onImport = async (ev: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    setDesktopError(null);
    try {
      setDesktopLoading(true);
      await uploadModel(file);
      await emitConfigChanged();
    } catch (e) {
      setDesktopLoading(false);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const onSwitch = async (objectFileId: number): Promise<void> => {
    setError(null);
    setDesktopError(null);
    setDesktopLoading(true);
    try {
      await setActiveModel(objectFileId);
      await refreshConfig();
      await emitConfigChanged();
    } catch (e) {
      setDesktopLoading(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onDelete = async (objectFileId: number, name: string): Promise<void> => {
    const ok = await showConfirm({
      title: "删除确认",
      description: `确定删除模型「${name}」？此操作不可恢复。`,
      confirmLabel: "删除",
      variant: "error",
    });
    if (!ok) return;
    await deleteModel(objectFileId);
    await refreshConfig();
    await emitConfigChanged();
  };

  const busy = uploading || desktopLoading;
  const displayError = error ?? desktopError;

  return (
    <div className="flex flex-col gap-4">
      <label
        className={cn(
          buttonVariants(),
          "w-full cursor-pointer",
          busy && "pointer-events-none opacity-50",
        )}
      >
        {busy ? <Spinner className="size-4" /> : null}
        {uploading ? "导入中…" : desktopLoading ? "加载模型中…" : "导入 VRM 模型"}
        <input
          type="file"
          accept=".vrm"
          className="hidden"
          disabled={busy}
          onChange={(e) => void onImport(e)}
        />
      </label>
      {desktopLoading && !uploading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner className="size-3.5" />
          桌面伴侣正在加载当前模型…
        </p>
      ) : null}
      {displayError ? (
        <Alert variant="error" className="py-2">
          <AlertDescription className="text-xs">{displayError}</AlertDescription>
        </Alert>
      ) : null}

      <ul className="flex flex-col gap-2">
        {models.length === 0 ? (
          <li className="text-center text-sm text-muted-foreground py-6">暂无模型</li>
        ) : (
          models.map((m, index) => (
            <li key={m.object_file_id}>
              <Card className="gap-0 border bg-muted/30 py-0 shadow-none">
                <CardContent className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      className="h-auto min-h-0 flex-1 border-0 bg-transparent px-0 font-medium shadow-none focus-visible:ring-0"
                      defaultValue={m.name}
                      onBlur={(e) => {
                        const name = e.target.value.trim();
                        if (name && name !== m.name) {
                          void renameModel(m.object_file_id, name).then(() => refreshConfig());
                        }
                      }}
                    />
                    {m.object_file_id === activeObjectFileId ? (
                      <Badge variant="success" className="shrink-0">
                        {desktopLoading ? "加载中" : "当前"}
                      </Badge>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 px-2 text-xs"
                        isDisabled={busy}
                        onClick={() => void onSwitch(m.object_file_id)}
                      >
                        切换
                      </Button>
                    )}
                  </div>
                  <p
                    className="text-xs text-muted-foreground truncate"
                    title={`object_file ${m.object_file_id}`}
                  >
                    #{m.object_file_id}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      isDisabled={index === 0 || busy}
                      onClick={() => void moveModel(m.object_file_id, -1)}
                    >
                      上移
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      isDisabled={index >= models.length - 1 || busy}
                      onClick={() => void moveModel(m.object_file_id, 1)}
                    >
                      下移
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      isDisabled={busy}
                      onClick={() => void onDelete(m.object_file_id, m.name)}
                    >
                      删除
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
