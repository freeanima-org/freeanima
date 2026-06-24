import { useCompanionStore } from "@/stores/companion.ts";

function openHubSettings(): void {
  const shell = window.satelliteShell;
  if (shell?.openHubSettings) {
    void shell.openHubSettings();
    return;
  }
  window.alert("请在 FreeAnima Desktop 托盘菜单中打开「Hub 设置」");
}

export function GeneralTab() {
  const hubUrl = useCompanionStore((s) => s.hubUrl);
  const instanceId = useCompanionStore((s) => s.instanceId);
  const sapConnected = useCompanionStore((s) => s.sapConnected);

  return (
    <div className="flex flex-col gap-4">
      <div className="form-control w-full">
        <label className="label py-1">
          <span className="label-text">Hub 地址</span>
        </label>
        <p className="text-sm text-base-content/80 break-all">{hubUrl || "—"}</p>
        <button
          type="button"
          className="btn btn-sm btn-outline w-fit mt-2"
          onClick={openHubSettings}
        >
          在 Hub 设置中修改
        </button>
        <p className="text-xs text-base-content/60 mt-1">
          Hub 地址与远程 Token 由桌面壳 <code>~/.anima/shell-client.json</code> 统一管理。
        </p>
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
