import { useRef, useState, type ChangeEvent } from "react";
import { useCompanionStore } from "@/stores/companion.ts";

type Props = {
  standalone?: boolean;
};

export function SettingsPanel({ standalone = false }: Props) {
  const hubUrl = useCompanionStore((s) => s.hubUrl);
  const modelPath = useCompanionStore((s) => s.modelPath);
  const updateSettings = useCompanionStore((s) => s.updateSettings);
  const uploadModel = useCompanionStore((s) => s.uploadModel);

  const [hub, setHub] = useState(hubUrl);
  const [model, setModel] = useState(modelPath);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const save = async (): Promise<void> => {
    setSaving(true);
    try {
      await updateSettings({ hub_url: hub, model_path: model });
    } finally {
      setSaving(false);
    }
  };

  const onImportClick = (): void => {
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const onFileSelected = async (ev: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    try {
      await uploadModel(file);
      const settings = useCompanionStore.getState();
      setModel(settings.modelPath);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={standalone ? "settings-panel-standalone" : "settings-panel"}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium">设置</h2>
      </div>
      <div className="space-y-3">
        <div>
          <label htmlFor="hub-url">Hub 地址</label>
          <input
            id="hub-url"
            value={hub}
            onChange={(e) => setHub(e.target.value)}
            placeholder="http://127.0.0.1:2658"
          />
        </div>
        <div>
          <label htmlFor="model-path">VRM 模型路径</label>
          <input
            id="model-path"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="/models/your-model.vrm"
          />
          <p className="text-xs text-white/40 mt-1">
            推荐在下方导入本地 .vrm；也可手动填写路径或开发期放入 public/models/
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".vrm,model/gltf-binary"
            className="hidden"
            onChange={(e) => void onFileSelected(e)}
          />
          <button
            type="button"
            className="mt-2 w-full rounded-lg py-1.5 bg-white/5 hover:bg-white/10 text-sm"
            disabled={uploading}
            onClick={onImportClick}
          >
            {uploading ? "导入中…" : "导入模型"}
          </button>
          {uploadError ? <p className="text-xs text-red-300 mt-1">{uploadError}</p> : null}
        </div>
        <button
          type="button"
          className="w-full rounded-lg py-1.5 bg-white/10 hover:bg-white/15 text-sm"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
    </div>
  );
}
