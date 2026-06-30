import { useEffect, useState, type ChangeEvent } from "react";
import { deleteMotion, renameMotion, uploadMotionFile } from "@/lib/api.ts";
import { useCompanionStore } from "@/stores/companion.ts";
import { emitConfigChanged } from "@/lib/electron.ts";
import { COMPANION_WINDOW_HEIGHT, COMPANION_WINDOW_WIDTH } from "@/lib/window-metrics.ts";
import { FBX_IMPORT_UNAVAILABLE_MSG } from "@shared/constants.ts";
import type { MotionLibraryEntry } from "@shared/constants.ts";
import { MotionPreviewCanvas } from "./MotionPreviewCanvas.tsx";

/** 预览区与伴侣窗同尺寸（160×260），侧栏含 card padding */
const PREVIEW_FRAME_WIDTH = COMPANION_WINDOW_WIDTH;
const PREVIEW_SIDEBAR_WIDTH = PREVIEW_FRAME_WIDTH + 24;

export function MotionLibraryTab() {
  const library = useCompanionStore((s) => s.motionLibrary);
  const modelPath = useCompanionStore((s) => s.modelPath);
  const fbxImportAvailable = useCompanionStore((s) => s.fbxImportAvailable);
  const refreshConfig = useCompanionStore((s) => s.refreshConfig);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const previewEntry = library.find((m) => m.id === previewId) ?? null;
  const accept = fbxImportAvailable
    ? ".vrma,.fbx,.zip,application/zip,model/gltf-binary"
    : ".vrma,.zip,application/zip,model/gltf-binary";

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
        if (!fbxImportAvailable && file.name.toLowerCase().endsWith(".fbx")) {
          setError(FBX_IMPORT_UNAVAILABLE_MSG);
          continue;
        }
        const result = await uploadMotionFile(file);
        importedEntries.push(...result.entries);
        if (result.library.length > 0) {
          useCompanionStore.setState({ motionLibrary: result.library });
        }
        if (result.skipped_fbx?.length) {
          setNotice(
            `已导入 VRMA；已跳过 ${result.skipped_fbx.length} 个 FBX（当前环境不支持转换）`,
          );
        }
      }
      if (importedEntries.length > 0) {
        setPreviewId(importedEntries.at(-1)!.id);
      }
      await refreshConfig();
      await emitConfigChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 min-h-0 flex-1">
      <div className="shrink-0 space-y-3">
        <p className="text-xs text-base-content/55 leading-relaxed">
          共 {library.length} 个动作。导入后在此列表显示；「动作槽位」Tab 用于绑定播放分组。
          {fbxImportAvailable
            ? " 支持 .vrma / .fbx，或包含 vrma、fbx 的 .zip。"
            : " 支持 .vrma 或含 vrma 的 .zip；FBX 需 sidecar 已安装 FBX2glTF。"}
        </p>
        <label className="btn btn-primary w-full cursor-pointer">
          {importing ? <span className="loading loading-spinner loading-sm" /> : null}
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
          <div role="alert" className="alert alert-error alert-sm py-2">
            <span className="text-xs">{error}</span>
          </div>
        ) : null}
        {notice ? (
          <div role="status" className="alert alert-info alert-sm py-2">
            <span className="text-xs">{notice}</span>
          </div>
        ) : null}
      </div>

      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden items-stretch">
        <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
          <ul className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto pr-1 overscroll-contain">
            {library.length === 0 ? (
              <li className="text-center text-sm text-base-content/50 py-6">暂无动作</li>
            ) : (
              library.map((m) => (
                <li
                  key={m.id}
                  className={`card card-border bg-base-100 shrink-0 ${
                    previewId === m.id ? "ring-2 ring-primary/40" : ""
                  }`}
                >
                  <div className="card-body py-3 px-4 gap-2">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <input
                          className="input input-ghost input-sm w-full px-0 h-auto min-h-0 font-medium"
                          defaultValue={m.name}
                          onBlur={(e) => {
                            const name = e.target.value.trim();
                            if (name && name !== m.name) {
                              void renameMotion(m.id, name).then(() => refreshConfig());
                            }
                          }}
                        />
                        <p className="text-xs text-base-content/50 mt-1 truncate" title={m.id}>
                          {m.id}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          type="button"
                          className={`btn btn-xs ${previewId === m.id ? "btn-primary" : "btn-ghost"}`}
                          onClick={() => setPreviewId(previewId === m.id ? null : m.id)}
                        >
                          预览
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs text-error"
                          onClick={() =>
                            void deleteMotion(m.id)
                              .then(() => refreshConfig())
                              .then(() => emitConfigChanged())
                              .then(() => {
                                if (previewId === m.id) setPreviewId(null);
                              })
                          }
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <aside
          className="card card-border bg-base-100 shrink-0 self-start sticky top-0"
          style={{ width: PREVIEW_SIDEBAR_WIDTH }}
        >
          <div className="card-body p-3 gap-2">
            <h3 className="text-sm font-medium">预览</h3>
            <p className="text-[10px] text-base-content/45">
              {COMPANION_WINDOW_WIDTH}×{COMPANION_WINDOW_HEIGHT} 与伴侣窗一致；拖拽可旋转视角
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
                <p className="text-xs text-base-content/50 px-2 text-center">选择动作后预览</p>
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
                <p className="text-xs text-base-content/50 px-2 text-center">
                  请先在「模型」Tab 导入 VRM
                </p>
              </div>
            ) : (
              <MotionPreviewCanvas
                key={`${modelPath}:${previewEntry.id}`}
                modelPath={modelPath}
                motionFile={previewEntry.file}
                width={PREVIEW_FRAME_WIDTH}
              />
            )}
            {previewEntry ? (
              <p className="text-xs text-base-content/50 truncate">{previewEntry.name}</p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
