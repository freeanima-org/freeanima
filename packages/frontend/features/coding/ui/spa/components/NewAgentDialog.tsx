import { useEffect, useState } from "react";
import { FolderIcon, FolderXIcon, ServerIcon } from "lucide-react";
import type { SshRemoteTarget } from "@freeanima/shared/coding/ssh-remote";

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceRoots: string[];
  knownSshTargets?: SshRemoteTarget[];
  onSelectWorkspace: (root: string) => void;
  onPickFolder: () => void;
  onNoWorkspace: () => void;
  onConnectSsh: (draft: {
    user: string;
    host: string;
    port?: number;
    identityFile?: string;
    remoteWorkspace: string;
  }) => void | Promise<void>;
  sshBusy?: boolean;
  sshError?: string | null;
};

/** New Agent：本地工作区 / SSH Remote / 无工作区 */
export function NewAgentDialog({
  open,
  onClose,
  workspaceRoots,
  knownSshTargets = [],
  onSelectWorkspace,
  onPickFolder,
  onNoWorkspace,
  onConnectSsh,
  sshBusy,
  sshError,
}: Props) {
  const [selected, setSelected] = useState("");
  const [mode, setMode] = useState<"local" | "ssh">("local");
  const [sshUser, setSshUser] = useState("");
  const [sshHost, setSshHost] = useState("");
  const [sshPort, setSshPort] = useState("");
  const [sshPath, setSshPath] = useState("");
  const [sshIdentity, setSshIdentity] = useState("");

  useEffect(() => {
    if (open) {
      setSelected("");
      setMode("local");
      setSshUser("");
      setSshHost("");
      setSshPort("");
      setSshPath("");
      setSshIdentity("");
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="coding-search-overlay" role="dialog" aria-label="新建 Agent">
      <button
        type="button"
        className="coding-search-backdrop"
        aria-label="关闭"
        onClick={onClose}
      />
      <div className="coding-new-agent">
        <h2>新建 Agent</h2>
        <p className="muted">本地工作区或 SSH 远程；选定后锁定到本会话。</p>

        <div className="coding-new-agent-actions" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className={`coding-btn ${mode === "local" ? "coding-btn-primary" : ""}`}
            onClick={() => setMode("local")}
          >
            本地
          </button>
          <button
            type="button"
            className={`coding-btn ${mode === "ssh" ? "coding-btn-primary" : ""}`}
            onClick={() => setMode("ssh")}
          >
            <ServerIcon className="size-3.5" />
            SSH 远程
          </button>
        </div>

        {mode === "local" ? (
          <>
            {workspaceRoots.length > 0 ? (
              <div className="coding-new-agent-select">
                <select
                  className="coding-select"
                  value={selected}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelected(value);
                    if (value) onSelectWorkspace(value);
                  }}
                >
                  <option value="" disabled>
                    选择已有工作区…
                  </option>
                  {workspaceRoots.map((root) => (
                    <option key={root} value={root}>
                      {root}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="muted">暂无已记录的工作区，请选择新文件夹。</p>
            )}

            <div className="coding-new-agent-actions">
              <button
                type="button"
                className="coding-btn coding-btn-primary"
                onClick={onPickFolder}
              >
                <FolderIcon className="size-3.5" />
                选择新文件夹
              </button>
              <button type="button" className="coding-btn" onClick={onNoWorkspace}>
                <FolderXIcon className="size-3.5" />
                无工作区
              </button>
              <button type="button" className="coding-btn" onClick={onClose}>
                取消
              </button>
            </div>
          </>
        ) : (
          <div className="coding-new-agent-select" style={{ display: "grid", gap: 8 }}>
            {knownSshTargets.length > 0 ? (
              <select
                className="coding-select"
                defaultValue=""
                onChange={(e) => {
                  const key = e.target.value;
                  const t = knownSshTargets.find(
                    (x) => `${x.user}@${x.host}:${x.remoteWorkspace}` === key,
                  );
                  if (!t) return;
                  setSshUser(t.user);
                  setSshHost(t.host);
                  setSshPort(t.port != null ? String(t.port) : "");
                  setSshPath(t.remoteWorkspace);
                  setSshIdentity(t.identityFile ?? "");
                }}
              >
                <option value="" disabled>
                  填入已知 SSH 目标…
                </option>
                {knownSshTargets.map((t) => {
                  const key = `${t.user}@${t.host}:${t.remoteWorkspace}`;
                  return (
                    <option key={key} value={key}>
                      {t.user}@{t.host}:{t.remoteWorkspace}
                    </option>
                  );
                })}
              </select>
            ) : null}
            <input
              className="coding-select"
              placeholder="user"
              value={sshUser}
              onChange={(e) => setSshUser(e.target.value)}
            />
            <input
              className="coding-select"
              placeholder="host"
              value={sshHost}
              onChange={(e) => setSshHost(e.target.value)}
            />
            <input
              className="coding-select"
              placeholder="port（可选，默认 22）"
              value={sshPort}
              onChange={(e) => setSshPort(e.target.value)}
            />
            <input
              className="coding-select"
              placeholder="远端绝对路径 /home/…/repo"
              value={sshPath}
              onChange={(e) => setSshPath(e.target.value)}
            />
            <input
              className="coding-select"
              placeholder="identity file（可选）"
              value={sshIdentity}
              onChange={(e) => setSshIdentity(e.target.value)}
            />
            {sshError ? (
              <p className="muted" style={{ color: "var(--destructive, #c44)" }}>
                {sshError}
              </p>
            ) : null}
            <div className="coding-new-agent-actions">
              <button
                type="button"
                className="coding-btn coding-btn-primary"
                disabled={Boolean(sshBusy)}
                onClick={() => {
                  void onConnectSsh({
                    user: sshUser.trim(),
                    host: sshHost.trim(),
                    remoteWorkspace: sshPath.trim(),
                    ...(sshPort.trim() ? { port: Number(sshPort.trim()) } : {}),
                    ...(sshIdentity.trim() ? { identityFile: sshIdentity.trim() } : {}),
                  });
                }}
              >
                {sshBusy ? "连接中…" : "连接 SSH"}
              </button>
              <button
                type="button"
                className="coding-btn"
                onClick={onClose}
                disabled={Boolean(sshBusy)}
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
