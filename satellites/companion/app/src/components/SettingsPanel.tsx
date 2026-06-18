import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  clearLocomotionMotion,
  downloadMotionsFromMirror,
  fetchLocomotionStatus,
  fetchMotionStatus,
  uploadLocomotionMotion,
  uploadMotionZip,
  type LocomotionStatus,
  type MotionStatus,
} from "@/lib/api.ts";
import {
  LOCOMOTION_SLOT_LABELS,
  LOCOMOTION_SLOTS,
  type LocomotionSlot,
} from "@shared/constants.ts";
import { useCompanionStore } from "@/stores/companion.ts";
import { emitConfigChanged } from "@/lib/tauri.ts";

type Props = {
  standalone?: boolean;
};

type LocomotionRow = {
  slot: LocomotionSlot;
  label: string;
  file: string | null;
  available: boolean;
};

const LOCOMOTION_SLOT_DEFS = LOCOMOTION_SLOTS.map((slot) => ({
  slot,
  label: LOCOMOTION_SLOT_LABELS[slot],
}));

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

  const [motionStatus, setMotionStatus] = useState<MotionStatus | null>(null);
  const [motionLoading, setMotionLoading] = useState(true);
  const [motionImporting, setMotionImporting] = useState(false);
  const [motionDownloading, setMotionDownloading] = useState(false);
  const [motionError, setMotionError] = useState<string | null>(null);

  const [locomotionStatus, setLocomotionStatus] = useState<LocomotionStatus | null>(null);
  const [locomotionLoading, setLocomotionLoading] = useState(true);
  const [locomotionImporting, setLocomotionImporting] = useState<LocomotionSlot | null>(null);
  const [locomotionError, setLocomotionError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const motionZipInputRef = useRef<HTMLInputElement>(null);
  const locomotionInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const refreshMotionStatus = async (): Promise<void> => {
    setMotionLoading(true);
    try {
      setMotionStatus(await fetchMotionStatus());
    } catch (e) {
      setMotionError(e instanceof Error ? e.message : String(e));
    } finally {
      setMotionLoading(false);
    }
  };

  const refreshLocomotionStatus = async (): Promise<void> => {
    setLocomotionLoading(true);
    try {
      setLocomotionStatus(await fetchLocomotionStatus());
    } catch (e) {
      setLocomotionError(e instanceof Error ? e.message : String(e));
    } finally {
      setLocomotionLoading(false);
    }
  };

  useEffect(() => {
    void refreshMotionStatus();
    void refreshLocomotionStatus();
  }, []);

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

  const onMotionImportClick = (): void => {
    setMotionError(null);
    motionZipInputRef.current?.click();
  };

  const onMotionZipSelected = async (ev: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;

    setMotionImporting(true);
    setMotionError(null);
    try {
      await uploadMotionZip(file);
      await refreshMotionStatus();
    } catch (e) {
      setMotionError(e instanceof Error ? e.message : String(e));
    } finally {
      setMotionImporting(false);
    }
  };

  const onOpenBooth = (): void => {
    const url = motionStatus?.booth_url ?? "https://booth.pm/ja/items/5512385";
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const onAutoDownload = async (): Promise<void> => {
    setMotionDownloading(true);
    setMotionError(null);
    try {
      await downloadMotionsFromMirror();
      await refreshMotionStatus();
    } catch (e) {
      setMotionError(e instanceof Error ? e.message : String(e));
    } finally {
      setMotionDownloading(false);
    }
  };

  const locomotionRows = useMemo<LocomotionRow[]>(() => {
    return LOCOMOTION_SLOT_DEFS.map((def) => {
      const status = locomotionStatus?.slots.find((s) => s.slot === def.slot);
      return {
        slot: def.slot,
        label: def.label,
        file: status?.file ?? null,
        available: status?.available ?? false,
      };
    });
  }, [locomotionStatus]);

  const onLocomotionPick = (slot: LocomotionSlot, kind: "fbx" | "vrma"): void => {
    setLocomotionError(null);
    locomotionInputRefs.current[`${slot}:${kind}`]?.click();
  };

  const onLocomotionSelected =
    (slot: LocomotionSlot) =>
    async (ev: ChangeEvent<HTMLInputElement>): Promise<void> => {
      const file = ev.target.files?.[0];
      ev.target.value = "";
      if (!file) return;

      setLocomotionImporting(slot);
      setLocomotionError(null);
      try {
        await uploadLocomotionMotion(slot, file);
        await refreshLocomotionStatus();
        await emitConfigChanged();
      } catch (e) {
        setLocomotionError(e instanceof Error ? e.message : String(e));
      } finally {
        setLocomotionImporting(null);
      }
    };

  const onLocomotionClear = async (slot: LocomotionSlot): Promise<void> => {
    setLocomotionError(null);
    try {
      await clearLocomotionMotion(slot);
      await refreshLocomotionStatus();
      await emitConfigChanged();
    } catch (e) {
      setLocomotionError(e instanceof Error ? e.message : String(e));
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

        <div className="pt-2 border-t border-white/10">
          <label>VRMA 动作包</label>
          <p className="text-xs text-white/40 mt-1">
            VRoid 官方动作需在 BOOTH 登录后下载 ZIP；导入后保存到{" "}
            <span className="text-white/60">
              {motionStatus?.user_dir ?? "~/.anima/companion/motions"}
            </span>
          </p>
          <p className="text-xs mt-1">
            {motionLoading ? (
              <span className="text-white/40">检查动作文件…</span>
            ) : motionStatus?.ready ? (
              <span className="text-emerald-300">
                已就绪（{motionStatus.required.length} 个文件）
              </span>
            ) : (
              <span className="text-amber-300">未安装 — 将回退到程序化 idle</span>
            )}
          </p>
          <input
            ref={motionZipInputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={(e) => void onMotionZipSelected(e)}
          />
          <div className="mt-2 flex flex-col gap-2">
            <button
              type="button"
              className="w-full rounded-lg py-1.5 bg-white/5 hover:bg-white/10 text-sm"
              onClick={onOpenBooth}
            >
              打开 BOOTH 下载页
            </button>
            <button
              type="button"
              className="w-full rounded-lg py-1.5 bg-white/5 hover:bg-white/10 text-sm"
              disabled={motionImporting}
              onClick={onMotionImportClick}
            >
              {motionImporting ? "导入中…" : "导入动作包 ZIP"}
            </button>
            {motionStatus?.auto_download_configured ? (
              <button
                type="button"
                className="w-full rounded-lg py-1.5 bg-white/5 hover:bg-white/10 text-sm"
                disabled={motionDownloading}
                onClick={() => void onAutoDownload()}
              >
                {motionDownloading ? "下载中…" : "从镜像自动下载"}
              </button>
            ) : null}
          </div>
          {motionError ? <p className="text-xs text-red-300 mt-1">{motionError}</p> : null}
        </div>

        <div className="pt-2 border-t border-white/10">
          <label>位移动作（按需导入）</label>
          <p className="text-xs text-white/40 mt-1">
            横向巡逻优先使用导入的「走路」VRMA；未导入时用程序化
            walk。纵向段始终用程序化攀爬（Mixamo 攀爬通常无 In
            Place，带位移会与窗口移动叠加导致出屏）。
          </p>
          {locomotionLoading ? <p className="text-xs text-white/40 mt-2">检查位移动作…</p> : null}
          <div className="mt-2 flex flex-col gap-2">
            {locomotionRows.map((row) => (
              <div key={row.slot} className="rounded-lg bg-white/5 p-2.5">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm text-white/85">{row.label}</span>
                  <span className="text-xs text-white/40 truncate max-w-[55%]">
                    {row.available && row.file ? row.file : "未导入（程序化）"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={(el) => {
                      locomotionInputRefs.current[`${row.slot}:fbx`] = el;
                    }}
                    type="file"
                    accept=".fbx"
                    className="hidden"
                    onChange={(e) => void onLocomotionSelected(row.slot)(e)}
                  />
                  <input
                    ref={(el) => {
                      locomotionInputRefs.current[`${row.slot}:vrma`] = el;
                    }}
                    type="file"
                    accept=".vrma,model/gltf-binary"
                    className="hidden"
                    onChange={(e) => void onLocomotionSelected(row.slot)(e)}
                  />
                  <button
                    type="button"
                    className="flex-1 min-w-[7rem] rounded-lg py-1.5 bg-white/5 hover:bg-white/10 text-xs"
                    disabled={locomotionImporting === row.slot}
                    onClick={() => onLocomotionPick(row.slot, "fbx")}
                  >
                    {locomotionImporting === row.slot ? "导入中…" : "导入 FBX"}
                  </button>
                  <button
                    type="button"
                    className="flex-1 min-w-[7rem] rounded-lg py-1.5 bg-white/5 hover:bg-white/10 text-xs"
                    disabled={locomotionImporting === row.slot}
                    onClick={() => onLocomotionPick(row.slot, "vrma")}
                  >
                    {locomotionImporting === row.slot ? "导入中…" : "导入 VRMA"}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1.5 bg-white/5 hover:bg-white/10 text-xs text-white/60"
                    disabled={!row.available || locomotionImporting === row.slot}
                    onClick={() => void onLocomotionClear(row.slot)}
                  >
                    清除
                  </button>
                </div>
              </div>
            ))}
          </div>
          {locomotionStatus?.user_dir ? (
            <p className="text-xs text-white/35 mt-2">保存目录：{locomotionStatus.user_dir}</p>
          ) : null}
          {locomotionError ? <p className="text-xs text-red-300 mt-1">{locomotionError}</p> : null}
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
