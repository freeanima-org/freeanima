import { FolderIcon, FolderXIcon } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onPickFolder: () => void;
  onNoWorkspace: () => void;
};

/** New Agent：选定文件夹或明确无工作区后锁定，之后不可换。 */
export function NewAgentDialog({ open, onClose, onPickFolder, onNoWorkspace }: Props) {
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
        <p className="muted">选择工作区后将锁定到本会话；换目录请再新建。</p>
        <div className="coding-new-agent-actions">
          <button type="button" className="coding-btn coding-btn-primary" onClick={onPickFolder}>
            <FolderIcon className="size-3.5" />
            选择文件夹
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
