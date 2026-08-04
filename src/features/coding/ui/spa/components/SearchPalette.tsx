import { useEffect, useMemo, useState } from "react";

import { basename, type CodingAgentSession } from "../lib/agent-sessions.ts";

export type SearchAction = {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  sessions: CodingAgentSession[];
  activeSession: CodingAgentSession | null;
  filePaths: string[];
  actions: SearchAction[];
  onSelectSession: (id: string) => void;
  onSelectFile: (path: string) => void;
};

type Tab = "agents" | "files" | "actions";

export function SearchPalette({
  open,
  onClose,
  sessions,
  activeSession,
  filePaths,
  actions,
  onSelectSession,
  onSelectFile,
}: Props) {
  const [tab, setTab] = useState<Tab>("agents");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    setQ("");
    setTab("agents");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const needle = q.trim().toLowerCase();
  const filteredSessions = useMemo(
    () =>
      sessions.filter(
        (s) =>
          !needle ||
          s.title.toLowerCase().includes(needle) ||
          (s.workspaceRoot ?? "").toLowerCase().includes(needle) ||
          basename(s.workspaceRoot ?? "")
            .toLowerCase()
            .includes(needle),
      ),
    [sessions, needle],
  );
  const filteredFiles = useMemo(
    () => filePaths.filter((p) => !needle || p.toLowerCase().includes(needle)),
    [filePaths, needle],
  );
  const filteredActions = useMemo(
    () =>
      actions.filter(
        (a) =>
          !needle ||
          a.label.toLowerCase().includes(needle) ||
          (a.hint ?? "").toLowerCase().includes(needle),
      ),
    [actions, needle],
  );

  if (!open) return null;

  return (
    <div className="coding-search-overlay" role="dialog" aria-label="搜索">
      <button
        type="button"
        className="coding-search-backdrop"
        aria-label="关闭"
        onClick={onClose}
      />
      <div className="coding-search-panel">
        <input
          className="coding-search-input"
          autoFocus
          value={q}
          placeholder="搜索 Agents / Files / Actions…"
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="coding-search-tabs">
          {(
            [
              ["agents", "Agents"],
              ["files", "Files"],
              ["actions", "Actions"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "active" : undefined}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <ul className="coding-search-results">
          {tab === "agents"
            ? filteredSessions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSession(s.id);
                      onClose();
                    }}
                  >
                    <span>{s.title}</span>
                    <span className="muted">
                      {s.workspaceRoot ? basename(s.workspaceRoot) : "无工作区"}
                      {s.id === activeSession?.id ? " · 当前" : ""}
                    </span>
                  </button>
                </li>
              ))
            : null}
          {tab === "files"
            ? filteredFiles.length === 0
              ? [
                  <li key="empty">
                    <span className="muted">
                      {activeSession?.workspaceRoot
                        ? "无匹配文件（可先在资源管理器展开）"
                        : "当前会话无工作区"}
                    </span>
                  </li>,
                ]
              : filteredFiles.map((p) => (
                  <li key={p}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectFile(p);
                        onClose();
                      }}
                    >
                      <code>{p}</code>
                    </button>
                  </li>
                ))
            : null}
          {tab === "actions"
            ? filteredActions.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      a.run();
                      onClose();
                    }}
                  >
                    <span>{a.label}</span>
                    {a.hint ? <span className="muted">{a.hint}</span> : null}
                  </button>
                </li>
              ))
            : null}
        </ul>
      </div>
    </div>
  );
}
