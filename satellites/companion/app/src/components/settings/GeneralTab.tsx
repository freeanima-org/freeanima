import { useCompanionStore } from "@/stores/companion.ts";

export function GeneralTab() {
  const instanceId = useCompanionStore((s) => s.instanceId);
  const sapConnected = useCompanionStore((s) => s.sapConnected);

  return (
    <div className="flex flex-col gap-4">
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
