import { useEffect, useState, type ChangeEvent } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardTitle,
  Input,
  Spinner,
  buttonVariants,
  cn,
} from "@freeanima/ui-kit";
import { showConfirm } from "@freeanima/ui-kit/composite";
import {
  deleteMotion,
  renameMotion,
  reorderMotions,
  uploadMotionFile,
} from "@freeanima/features/companion/ui/spa/lib/api.ts";
import { useCompanionStore } from "@freeanima/features/companion/ui/spa/stores/companion.ts";
import { emitConfigChanged } from "@freeanima/features/companion/ui/spa/lib/portal-shell.ts";
import {
  COMPANION_WINDOW_HEIGHT,
  COMPANION_WINDOW_WIDTH,
} from "@freeanima/features/companion/ui/spa/lib/window-metrics.ts";
import { companionMotionCachePath } from "@freeanima/features/companion/shared/companion-schema.ts";
import type { MotionLibraryEntry } from "@freeanima/features/companion/shared/constants.ts";
import { MotionPreviewCanvas } from "./MotionPreviewCanvas.tsx";

/** 预览区与伴侣窗同尺寸（160×260），侧栏含 card padding */
const PREVIEW_FRAME_WIDTH = COMPANION_WINDOW_WIDTH;
const PREVIEW_SIDEBAR_WIDTH = PREVIEW_FRAME_WIDTH + 24;

export function MotionLibraryTab() {
  const library = useCompanionStore((s) => s.motionLibrary);
  const modelPath = useCompanionStore((s) => s.modelPath);
  const refreshConfig = useCompanionStore((s) => s.refreshConfig);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);

  const previewEntry = library.find((m) => m.object_file_id === previewId) ?? null;
  const accept = ".vrma";

  const moveMotion = async (objectFileId: number, delta: -1 | 1): Promise<void> => {
    const ids = library.map((m) => m.object_file_id);
    const idx = ids.indexOf(objectFileId);
    const swap = idx + delta;
    if (idx < 0 || swap < 0 || swap >= ids.length) return;
    const next = [...ids];
    const a = next[idx];
    const b = next[swap];
    if (a == null || b == null) return;
    next[idx] = b;
    next[swap] = a;
    await reorderMotions(next);
    await refreshConfig();
  };

  useEffect(() => {
    void refreshConfig();
  }, [refreshConfig]);

  const onImport = async (ev: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const fileList = ev.target.files;
    if (!fileList?.length) return;
    const files = [...fileList];
    ev.target.value = "";

    setImporting(true);
    setError(null);
    setNotice(null);
    try {
      const importedEntries: MotionLibraryEntry[] = [];
      for (const file of files) {
        if (!file.name.toLowerCase().endsWith(".vrma")) {
          setError("仅支持 .vrma");
          continue;
        }
        const result = await uploadMotionFile(file);
        importedEntries.push(...result.entries);
        if (result.library.length > 0) {
          useCompanionStore.setState({ motionLibrary: result.library });
        }
      }
      if (importedEntries.length > 0) {
        const lastImported = importedEntries.at(-1);
        if (lastImported) setPreviewId(lastImported.object_file_id);
      }
      await refreshConfig();
      await emitConfigChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };

  const onDelete = async (entry: MotionLibraryEntry): Promise<void> => {
    const ok = await showConfirm({
      title: "删除确认",
      description: `确定删除动作「${entry.name}」？此操作不可恢复。`,
      confirmLabel: "删除",
      variant: "error",
    });
    if (!ok) return;
    await deleteMotion(entry.object_file_id);
    await refreshConfig();
    await emitConfigChanged();
    if (previewId === entry.object_file_id) setPreviewId(null);
  };

  return (
    <div className="flex flex-col gap-3 min-h-0 flex-1">
      <div className="shrink-0 space-y-3">
        <p className="text-xs text-foreground/55 leading-relaxed">
          共 {library.length} 个动作。导入后在此列表显示；「动作槽位」Tab 用于绑定播放分组。
          支持单个 .vrma（可多选）；若来源为动作包 zip，请先自行解压再导入。
        </p>
        <label
          className={cn(
            buttonVariants(),
            "w-full cursor-pointer",
            importing && "pointer-events-none opacity-50",
          )}
        >
          {importing ? <Spinner className="size-4" /> : null}
          {importing ? "导入中…" : "导入动作"}
          <input
            type="file"
            accept={accept}
            multiple
            className="hidden"
            disabled={importing}
            onChange={(e) => void onImport(e)}
          />
        </label>
        {error ? (
          <Alert variant="error" className="py-2">
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        ) : null}
        {notice ? (
          <Alert variant="info" className="py-2">
            <AlertDescription className="text-xs">{notice}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden items-stretch">
        <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
          <ul className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto pr-1 overscroll-contain">
            {library.length === 0 ? (
              <li className="text-center text-sm text-muted-foreground py-6">暂无动作</li>
            ) : (
              library.map((m, index) => (
                <li key={m.object_file_id}>
                  <Card
                    className={`gap-0 border bg-background py-0 shadow-none shrink-0 ${
                      previewId === m.object_file_id ? "ring-2 ring-primary/40" : ""
                    }`}
                  >
                    <CardContent className="flex flex-col gap-2 px-4 py-3">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <Input
                            className="h-auto min-h-0 w-full border-0 bg-transparent px-0 font-medium shadow-none focus-visible:ring-0"
                            defaultValue={m.name}
                            onBlur={(e) => {
                              const name = e.target.value.trim();
                              if (name && name !== m.name) {
                                void renameMotion(m.object_file_id, name).then(() =>
                                  refreshConfig(),
                                );
                              }
                            }}
                          />
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            #{m.object_file_id}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            variant={previewId === m.object_file_id ? "default" : "ghost"}
                            className="h-7 px-2 text-xs"
                            onClick={() =>
                              setPreviewId(previewId === m.object_file_id ? null : m.object_file_id)
                            }
                          >
                            预览
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={index === 0}
                            onClick={() => void moveMotion(m.object_file_id, -1)}
                          >
                            上移
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={index >= library.length - 1}
                            onClick={() => void moveMotion(m.object_file_id, 1)}
                          >
                            下移
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                            onClick={() => void onDelete(m)}
                          >
                            删除
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))
            )}
          </ul>
        </div>

        <Card
          className="gap-0 border bg-background py-0 shadow-none shrink-0 self-start sticky top-0"
          style={{ width: PREVIEW_SIDEBAR_WIDTH }}
        >
          <CardContent className="flex flex-col gap-2 p-3">
            <CardTitle className="text-sm font-medium">预览</CardTitle>
            <p className="text-[10px] text-foreground/45">
              {COMPANION_WINDOW_WIDTH}×{COMPANION_WINDOW_HEIGHT} 与角色显示比例一致；拖拽可旋转视角
            </p>
            {!previewEntry ? (
              <div
                className="motion-preview-frame flex items-center justify-center"
                style={{
                  width: PREVIEW_FRAME_WIDTH,
                  height: Math.round(
                    (PREVIEW_FRAME_WIDTH * COMPANION_WINDOW_HEIGHT) / COMPANION_WINDOW_WIDTH,
                  ),
                }}
              >
                <p className="text-xs text-muted-foreground px-2 text-center">选择动作后预览</p>
              </div>
            ) : !modelPath ? (
              <div
                className="motion-preview-frame flex items-center justify-center"
                style={{
                  width: PREVIEW_FRAME_WIDTH,
                  height: Math.round(
                    (PREVIEW_FRAME_WIDTH * COMPANION_WINDOW_HEIGHT) / COMPANION_WINDOW_WIDTH,
                  ),
                }}
              >
                <p className="text-xs text-muted-foreground px-2 text-center">
                  请先在「模型」Tab 导入 VRM
                </p>
              </div>
            ) : (
              <MotionPreviewCanvas
                key={`${modelPath}:${previewEntry.object_file_id}`}
                modelPath={modelPath}
                motionFile={companionMotionCachePath(previewEntry.object_file_id)}
                width={PREVIEW_FRAME_WIDTH}
              />
            )}
            {previewEntry ? (
              <p className="text-xs text-muted-foreground truncate">{previewEntry.name}</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
