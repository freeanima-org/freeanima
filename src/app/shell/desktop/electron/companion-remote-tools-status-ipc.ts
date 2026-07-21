import { ipcMain } from "electron";

export type CompanionRemoteToolsStatus = {
  instance_id: string;
  remote_tools_connected: boolean;
};

let lastStatus: CompanionRemoteToolsStatus = {
  instance_id: "",
  remote_tools_connected: false,
};

export type CompanionRemoteToolsStatusIpcHandle = {
  dispose: () => void;
  getStatus: () => CompanionRemoteToolsStatus;
};

/** overlay 上报 / 设置页读取 remote tools 状态 */
export function registerCompanionRemoteToolsStatusIpc(): CompanionRemoteToolsStatusIpcHandle {
  ipcMain.handle(
    "companion:remote-tools-status-report",
    (_event, status: CompanionRemoteToolsStatus) => {
      lastStatus = {
        instance_id: typeof status?.instance_id === "string" ? status.instance_id : "",
        remote_tools_connected: Boolean(status?.remote_tools_connected),
      };
    },
  );

  ipcMain.handle("companion:remote-tools-status-get", () => lastStatus);

  return {
    dispose: () => {
      ipcMain.removeHandler("companion:remote-tools-status-report");
      ipcMain.removeHandler("companion:remote-tools-status-get");
    },
    getStatus: () => lastStatus,
  };
}
