import { useEffect, useState } from "react";
import { FolderIcon, FolderXIcon } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceRoots: string[];
  onSelectWorkspace: (root: string) => void;
  onPickFolder: () => void;
  onNoWorkspace: () => void;
};

/** New Agent：从已有工作区下拉选择，或选新文件夹 / 无工作区；选定后锁定。 */
export function NewAgentDialog({
  open,
  onClose,
  workspaceRoots,
  onSelectWorkspace,
  onPickFolder,
  onNoWorkspace,
}: Props) {
  const [selected, setSelected] = useState("");

  useEffect(() => {
    if (open) setSelected("");
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
        <p className="muted">从已有工作区选择，或选新文件夹；选定后锁定到本会话。</p>

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
          <button type="button" className="coding-btn coding-btn-primary" onClick={onPickFolder}>
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
      </div>
    </div>
  );
}
