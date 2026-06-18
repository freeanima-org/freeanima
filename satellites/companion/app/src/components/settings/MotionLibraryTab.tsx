import { useEffect, useState } from "react";
import {
  downloadMotionsFromMirror,
  fetchMotionStatus,
  uploadMotionZip,
  type MotionStatus,
} from "@/lib/api.ts";
import { useCompanionStore } from "@/stores/companion.ts";
import { deleteMotion, renameMotion } from "@/lib/api.ts";
import { emitConfigChanged } from "@/lib/tauri.ts";
import type { ChangeEvent } from "react";

export function MotionLibraryTab() {
  const library = useCompanionStore((s) => s.motionLibrary);
  const refreshConfig = useCompanionStore((s) => s.refreshConfig);
  const [motionStatus, setMotionStatus] = useState<MotionStatus | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchMotionStatus()
      .then(setMotionStatus)
      .catch(() => {});
  }, [library.length]);

  const onZip = async (ev: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    setImporting(true);
    setError(null);
    try {
      await uploadMotionZip(file);
      await refreshConfig();
      await emitConfigChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/40">
        导入 VRMA 动作包 ZIP 或单个动作；可在「动作槽位」Tab 分配到各槽位。
      </p>
      <input
        type="file"
        accept=".zip"
        className="hidden"
        id="motion-zip"
        onChange={(e) => void onZip(e)}
      />
      <button
        type="button"
        className="w-full rounded-lg py-1.5 bg-white/5 hover:bg-white/10 text-sm"
        disabled={importing}
        onClick={() => document.getElementById("motion-zip")?.click()}
      >
        {importing ? "导入中…" : "导入动作包 ZIP"}
      </button>
      {motionStatus?.auto_download_configured ? (
        <button
          type="button"
          className="w-full rounded-lg py-1.5 bg-white/5 hover:bg-white/10 text-sm"
          onClick={() =>
            void downloadMotionsFromMirror()
              .then(() => refreshConfig())
              .then(() => emitConfigChanged())
          }
        >
          从镜像自动下载
        </button>
      ) : null}
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      <ul className="space-y-2 max-h-48 overflow-y-auto">
        {library.length === 0 ? (
          <li className="text-xs text-white/40">暂无动作</li>
        ) : (
          library.map((m) => (
            <li key={m.id} className="rounded-lg bg-white/5 p-2 text-xs">
              <input
                className="w-full bg-transparent border-b border-white/10"
                defaultValue={m.name}
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (name && name !== m.name) {
                    void renameMotion(m.id, name).then(() => refreshConfig());
                  }
                }}
              />
              <p className="text-white/40 mt-1">{m.file}</p>
              <button
                type="button"
                className="mt-1 text-red-300/80"
                onClick={() =>
                  void deleteMotion(m.id)
                    .then(() => refreshConfig())
                    .then(() => emitConfigChanged())
                }
              >
                删除
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
