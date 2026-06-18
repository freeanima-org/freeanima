import { useState, type ChangeEvent } from "react";
import { deleteModel, renameModel, setActiveModel } from "@/lib/api.ts";
import { useCompanionStore } from "@/stores/companion.ts";
import { emitConfigChanged } from "@/lib/tauri.ts";

export function ModelsTab() {
  const models = useCompanionStore((s) => s.models);
  const activeModelId = useCompanionStore((s) => s.activeModelId);
  const uploadModel = useCompanionStore((s) => s.uploadModel);
  const refreshConfig = useCompanionStore((s) => s.refreshConfig);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onImport = async (ev: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadModel(file);
      await emitConfigChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        type="file"
        accept=".vrm"
        className="hidden"
        id="model-import"
        onChange={(e) => void onImport(e)}
      />
      <button
        type="button"
        className="w-full rounded-lg py-1.5 bg-white/5 hover:bg-white/10 text-sm"
        disabled={uploading}
        onClick={() => document.getElementById("model-import")?.click()}
      >
        {uploading ? "导入中…" : "导入模型"}
      </button>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      <ul className="space-y-2">
        {models.length === 0 ? (
          <li className="text-xs text-white/40">暂无模型</li>
        ) : (
          models.map((m) => (
            <li key={m.id} className="rounded-lg bg-white/5 p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <input
                  className="flex-1 bg-transparent border-b border-white/10"
                  defaultValue={m.name}
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (name && name !== m.name) {
                      void renameModel(m.id, name).then(() => refreshConfig());
                    }
                  }}
                />
                {m.id === activeModelId ? (
                  <span className="text-emerald-300 shrink-0">当前</span>
                ) : (
                  <button
                    type="button"
                    className="shrink-0 text-white/70 hover:text-white"
                    onClick={() =>
                      void setActiveModel(m.id)
                        .then(() => refreshConfig())
                        .then(() => emitConfigChanged())
                    }
                  >
                    切换
                  </button>
                )}
              </div>
              <p className="text-white/40 mt-1 truncate">{m.path}</p>
              <button
                type="button"
                className="mt-1 text-red-300/80 hover:text-red-300"
                onClick={() =>
                  void deleteModel(m.id)
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
