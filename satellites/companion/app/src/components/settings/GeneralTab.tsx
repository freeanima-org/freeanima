import { useCompanionStore } from "@/stores/companion.ts";

export function GeneralTab() {
  const hubUrl = useCompanionStore((s) => s.hubUrl);
  const instanceId = useCompanionStore((s) => s.instanceId);
  const sapConnected = useCompanionStore((s) => s.sapConnected);
  const updateSettings = useCompanionStore((s) => s.updateSettings);

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="hub-url">Hub 地址</label>
        <input
          id="hub-url"
          defaultValue={hubUrl}
          key={hubUrl}
          placeholder="http://127.0.0.1:2658"
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== hubUrl) void updateSettings({ hub_url: v });
          }}
        />
      </div>
      <div className="text-xs text-white/50 space-y-1">
        <p>
          实例 ID：<span className="text-white/70">{instanceId || "—"}</span>
        </p>
        <p>
          SAP：
          <span className={sapConnected ? "text-emerald-300" : "text-amber-300"}>
            {sapConnected ? "已连接" : "未连接"}
          </span>
        </p>
      </div>
    </div>
  );
}
