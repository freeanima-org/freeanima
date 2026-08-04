import { MessageSquarePlusIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { cn } from "@freeanima/ui-kit";

import { groupSessionsByRepo, type CodingAgentSession } from "../lib/agent-sessions.ts";

type Props = {
  sessions: CodingAgentSession[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onOpenSearch?: () => void;
};

export function AgentSessionSidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
  onDelete,
  onOpenSearch,
}: Props) {
  const groups = groupSessionsByRepo(sessions);

  return (
    <aside className="coding-pane coding-agents" aria-label="Agent 会话">
      <div className="coding-agents-head">
        <h2>Agents</h2>
        <div className="coding-agents-actions">
          {onOpenSearch ? (
            <button
              type="button"
              className="coding-btn coding-btn-icon"
              title="搜索"
              onClick={onOpenSearch}
            >
              <SearchIcon className="size-3.5" />
            </button>
          ) : null}
          <button
            type="button"
            className="coding-btn coding-btn-icon"
            title="新建 Agent"
            onClick={onNew}
          >
            <MessageSquarePlusIcon className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="coding-agents-scroll">
        {groups.map((g) => (
          <div key={g.key} className="coding-repo-group">
            <div className="coding-repo-label" title={g.workspaceRoot ?? undefined}>
              {g.key}
            </div>
            <ul className="coding-agents-list">
              {g.sessions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={cn("coding-agent-row", s.id === activeSessionId && "active")}
                    onClick={() => onSelect(s.id)}
                  >
                    <span className="coding-agent-title">{s.title}</span>
                    <span className="coding-agent-meta muted">
                      {s.conversationId ? "已绑定对话" : "待开对话"}
                    </span>
                  </button>
                  {sessions.length > 1 ? (
                    <button
                      type="button"
                      className="coding-agent-del"
                      title="删除会话"
                      onClick={() => onDelete(s.id)}
                    >
                      <Trash2Icon className="size-3" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="muted coding-agents-hint">
        一对话一根工作区，创建后不可更换。换目录请新建 Agent。
      </p>
    </aside>
  );
}
