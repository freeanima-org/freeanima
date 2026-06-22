import { useState, type ChangeEvent } from "react";
import { deleteModel, renameModel, setActiveModel } from "@/lib/api.ts";
import { useCompanionStore } from "@/stores/companion.ts";
import { emitConfigChanged } from "@/lib/electron.ts";

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
    <div className="flex flex-col gap-4">
      <label className="btn btn-primary w-full cursor-pointer">
        {uploading ? <span className="loading loading-spinner loading-sm" /> : null}
        {uploading ? "导入中…" : "导入 VRM 模型"}
        <input
          type="file"
          accept=".vrm"
          className="hidden"
          disabled={uploading}
          onChange={(e) => void onImport(e)}
        />
      </label>
      {error ? (
        <div role="alert" className="alert alert-error alert-sm py-2">
          <span className="text-xs">{error}</span>
        </div>
      ) : null}

      <ul className="flex flex-col gap-2">
        {models.length === 0 ? (
          <li className="text-center text-sm text-base-content/50 py-6">暂无模型</li>
        ) : (
          models.map((m) => (
            <li key={m.id} className="card card-border bg-base-300/30">
              <div className="card-body py-3 px-4 gap-2">
                <div className="flex items-center justify-between gap-2">
                  <input
                    className="input input-ghost input-sm flex-1 px-0 h-auto min-h-0 font-medium"
                    defaultValue={m.name}
                    onBlur={(e) => {
                      const name = e.target.value.trim();
                      if (name && name !== m.name) {
                        void renameModel(m.id, name).then(() => refreshConfig());
                      }
                    }}
                  />
                  {m.id === activeModelId ? (
                    <span className="badge badge-success badge-sm shrink-0">当前</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs shrink-0"
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
                <p className="text-xs text-base-content/50 truncate" title={m.id}>
                  {m.id}
                </p>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs text-error self-start px-2"
                  onClick={() =>
                    void deleteModel(m.id)
                      .then(() => refreshConfig())
                      .then(() => emitConfigChanged())
                  }
                >
                  删除
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
