import { useCompanionStore } from "@/stores/companion.ts";

export function GeneralTab() {
  const hubUrl = useCompanionStore((s) => s.hubUrl);
  const instanceId = useCompanionStore((s) => s.instanceId);
  const sapConnected = useCompanionStore((s) => s.sapConnected);
  const updateSettings = useCompanionStore((s) => s.updateSettings);

  return (
    <div className="flex flex-col gap-4">
      <div className="form-control w-full">
        <label className="label py-1" htmlFor="hub-url">
          <span className="label-text">Hub 地址</span>
        </label>
        <input
          id="hub-url"
          type="text"
          className="input input-bordered w-full input-sm"
          defaultValue={hubUrl}
          key={hubUrl}
          placeholder="http://127.0.0.1:2658"
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== hubUrl) void updateSettings({ hub_url: v });
          }}
        />
      </div>
      <div className="card card-border bg-base-300/30">
        <div className="card-body py-3 px-4 text-xs text-base-content/70 gap-1">
          <p>
            实例 ID：<span className="text-base-content">{instanceId || "—"}</span>
          </p>
          <p>
            SAP：
            <span className={sapConnected ? "text-success" : "text-warning"}>
              {sapConnected ? "已连接" : "未连接"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
