import { useCallback, useEffect, useMemo, useState } from "react";

import { subscribeConversationUpdates } from "@freeanima/features/chat/ui/spa/lib/api.ts";
import { resolveDefaultChatAgentSubjectId } from "@freeanima/features/chat/ui/spa/lib/default-chat-agent.ts";

import { AgentChatPane } from "./components/AgentChatPane.tsx";
import { AgentSessionSidebar } from "./components/AgentSessionSidebar.tsx";
import { CodePreview } from "./components/CodePreview.tsx";
import { ContextPanel, type ContextTab } from "./components/ContextPanel.tsx";
import { NewAgentDialog } from "./components/NewAgentDialog.tsx";
import { SearchPalette, type SearchAction } from "./components/SearchPalette.tsx";
import { TerminalLogPanel } from "./components/TerminalLogPanel.tsx";
import { WorkspaceFileTree } from "./components/WorkspaceFileTree.tsx";
import {
  archiveSession,
  createAgentSession,
  defaultTitle,
  getActiveSession,
  listKnownWorkspaceRoots,
  loadAgentSessions,
  patchSessionMeta,
  rememberWorkspace,
  removeSession,
  saveAgentSessions,
  upsertSession,
  type AgentSessionsState,
} from "./lib/agent-sessions.ts";
import {
  createProjectCodingNote,
  ensureCodingConversation,
  fetchCodingConversationTitle,
} from "./lib/habitat-session.ts";
import { loadProjectJsonFromWorkspace, type ParsedProjectJson } from "./lib/project-json.ts";
import {
  discoverWorkspaceProjectContext,
  syncProjectContextToHabitat,
} from "./lib/project-context.ts";
import {
  getCodingRemoteToolsHost,
  startCodingRemoteToolsHost,
  type CodingRemoteToolsStatus,
} from "./lib/remote-tools-host.ts";
import { setCodingWorkspace, subscribeTerminalLogs } from "./lib/tools-executor.ts";
import { createPortalShellWorkspaceBackend, WorkspaceSandbox } from "./lib/workspace-fs.ts";

type AttachStatus = CodingRemoteToolsStatus;

type SessionMeta = {
  conversation_id: string;
  project_world_id: number | null;
  world_created: boolean;
  platform: string;
  agent_subject_id?: number;
};

async function pickWorkspacePath(): Promise<string | null> {
  const shell = window.portalShell;
  if (!shell) {
    throw new Error(
      "portalShell 未注入：Coding Vite 页需 Tauri IPC（capabilities remote.urls 含 :4186；请重启 just dev tauri）",
    );
  }
  if (!shell.pickDirectory) {
    throw new Error("portalShell.pickDirectory 不可用（非桌面壳？）");
  }
  try {
    return await shell.pickDirectory();
  } catch (e) {
    throw new Error(`选目录失败：${e instanceof Error ? e.message : String(e)}`, { cause: e });
  }
}

export function CodingApp() {
  const [agents, setAgents] = useState<AgentSessionsState>(() => loadAgentSessions());
  const activeAgent = useMemo(() => getActiveSession(agents), [agents]);
  const workspaceRoot = activeAgent?.workspaceRoot ?? null;
  const knownWorkspaceRoots = useMemo(() => listKnownWorkspaceRoots(agents), [agents]);

  const [attach, setAttach] = useState<AttachStatus>({
    instance_id: "",
    remote_tools_connected: false,
  });
  const [project, setProject] = useState<ParsedProjectJson | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionMeta, setSessionMeta] = useState<SessionMeta | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [termCount, setTermCount] = useState(0);
  const [contextTab, setContextTab] = useState<ContextTab>("files");
  const [searchOpen, setSearchOpen] = useState(false);
  const [newAgentOpen, setNewAgentOpen] = useState(false);
  const [knownFiles, setKnownFiles] = useState<string[]>([]);

  useEffect(() => {
    if (!searchOpen || !workspaceRoot) return () => {};
    let cancelled = false;
    void (async () => {
      const backend = createPortalShellWorkspaceBackend();
      if (!backend) return;
      const sandbox = new WorkspaceSandbox(workspaceRoot, backend);
      const out = await sandbox.fileList({ path: ".", maxDepth: 2, maxEntries: 200 });
      if (cancelled || !out.ok) return;
      const files = out.entries
        .filter((e) => e.kind === "file")
        .map((e) => e.path)
        .filter(Boolean);
      setKnownFiles((prev) => {
        const set = new Set([...prev, ...files]);
        return [...set].toSorted();
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [searchOpen, workspaceRoot]);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteStatus, setNoteStatus] = useState<string | null>(null);

  useEffect(() => {
    saveAgentSessions(agents);
  }, [agents]);

  useEffect(() => {
    const handle = startCodingRemoteToolsHost({
      onStatus: setAttach,
    });
    const unsub = window.portalShell?.listenConfigChanged?.(() => {
      handle?.stop();
      startCodingRemoteToolsHost({ onStatus: setAttach });
    });
    return () => {
      unsub?.();
      handle?.stop();
    };
  }, []);

  useEffect(
    () =>
      subscribeTerminalLogs((logs) => {
        setTermCount(logs.length);
      }),
    [],
  );

  useEffect(() => {
    setSelectedPath(null);
    setPreviewText("");
    setKnownFiles([]);
    setSessionMeta(null);
    setSessionError(null);
  }, [activeAgent?.id]);

  useEffect(() => {
    if (!workspaceRoot) {
      setCodingWorkspace(null);
      setProject(null);
      return () => {};
    }
    let cancelled = false;
    const backend = createPortalShellWorkspaceBackend();
    setCodingWorkspace(backend ? { workspaceRoot, backend } : { workspaceRoot });
    setProject(null);
    void (async () => {
      setError(null);
      if (!backend) {
        if (!cancelled) {
          setError("缺少 portalShell.workspaceFs；工具执行需 Rust IPC");
          setProject(null);
        }
        return;
      }
      const pj = await loadProjectJsonFromWorkspace({
        workspaceRoot,
        readText: (p) => backend.readText(p),
      });
      if (cancelled) return;
      setProject(pj);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceRoot, activeAgent?.id]);

  const listTreeChildren = useCallback(
    async (relDir: string) => {
      const backend = createPortalShellWorkspaceBackend();
      if (!backend || !workspaceRoot) {
        return { ok: false as const, error: "缺少 portalShell.workspaceFs 或工作区" };
      }
      const sandbox = new WorkspaceSandbox(workspaceRoot, backend);
      return sandbox.fileList({ path: relDir, maxDepth: 0, maxEntries: 500 });
    },
    [workspaceRoot],
  );

  /** 复用已绑定 conversationId；仅在缺失且有 instance 时预热（可无工作区）。 */
  useEffect(() => {
    if (!attach.instance_id || !activeAgent) {
      setSessionMeta(null);
      setSessionError(null);
      return () => {};
    }
    if (!activeAgent.conversationId) {
      setSessionMeta(null);
      setSessionError(null);
      return () => {};
    }
    let cancelled = false;
    void (async () => {
      try {
        const boot = await ensureCodingConversation({
          workspaceRoot: activeAgent.workspaceRoot,
          instanceId: attach.instance_id,
          existingConversationId: activeAgent.conversationId,
          stableKey: project?.stable_key ?? null,
          displayName: project?.display_name ?? null,
        });
        if (cancelled) return;
        if (!boot) {
          setSessionMeta(null);
          return;
        }
        setSessionMeta({
          conversation_id: boot.conversation_id,
          project_world_id: boot.project_world_id,
          world_created: boot.world_created,
          platform: boot.platform,
          ...(boot.agent_subject_id != null ? { agent_subject_id: boot.agent_subject_id } : {}),
        });
        setSessionError(null);
      } catch (e) {
        if (cancelled) return;
        setSessionMeta(null);
        setSessionError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeAgent, attach.instance_id, project?.stable_key, project?.display_name]);

  /** 有 conversation + workspace 时发现项目上下文并 sync 到 Habitat */
  useEffect(() => {
    const conversationId = sessionMeta?.conversation_id ?? activeAgent?.conversationId;
    if (!conversationId || !workspaceRoot) return () => {};
    const backend = createPortalShellWorkspaceBackend();
    if (!backend) return () => {};
    let cancelled = false;
    void (async () => {
      try {
        const sandbox = new WorkspaceSandbox(workspaceRoot, backend);
        const snapshot = await discoverWorkspaceProjectContext(sandbox);
        if (cancelled) return;
        await syncProjectContextToHabitat({ conversationId, snapshot });
        const host = getCodingRemoteToolsHost();
        if (host && snapshot.mcpServers.length > 0) {
          await host.refreshProjectMcp(snapshot.mcpServers);
        } else if (host) {
          await host.refreshProjectMcp([]);
        }
      } catch (e) {
        console.warn("project context sync failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionMeta?.conversation_id, activeAgent?.conversationId, workspaceRoot]);

  const bindConversation = useCallback(
    async (_firstMessage: string): Promise<string | null> => {
      if (!activeAgent) return null;
      if (!attach.instance_id) {
        throw new Error("等待 Outpost instance_id…");
      }
      const creating = !activeAgent.conversationId;
      const agentSubjectId = creating ? await resolveDefaultChatAgentSubjectId() : undefined;
      const boot = await ensureCodingConversation({
        workspaceRoot: activeAgent.workspaceRoot,
        instanceId: attach.instance_id,
        existingConversationId: activeAgent.conversationId,
        stableKey: project?.stable_key ?? null,
        displayName: project?.display_name ?? activeAgent.title,
        ...(agentSubjectId != null ? { agentSubjectId } : {}),
      });
      if (!boot) return null;
      setSessionMeta({
        conversation_id: boot.conversation_id,
        project_world_id: boot.project_world_id,
        world_created: boot.world_created,
        platform: boot.platform,
        ...(boot.agent_subject_id != null ? { agent_subject_id: boot.agent_subject_id } : {}),
      });
      setAgents((prev) => {
        const cur = getActiveSession(prev);
        if (!cur || cur.id !== activeAgent.id) return prev;
        return upsertSession(prev, patchSessionMeta(cur, { conversationId: boot.conversation_id }));
      });
      setSessionError(null);
      return boot.conversation_id;
    },
    [activeAgent, attach.instance_id, project?.display_name, project?.stable_key],
  );

  useEffect(() => {
    const cid = activeAgent?.conversationId?.trim();
    if (!cid) return () => {};
    const sub = subscribeConversationUpdates(cid, () => {
      void (async () => {
        const title = await fetchCodingConversationTitle(cid);
        if (!title) return;
        setAgents((prev) => {
          const cur = prev.sessions.find((s) => s.conversationId === cid);
          if (!cur || cur.title === title) return prev;
          return upsertSession(prev, patchSessionMeta(cur, { title }));
        });
      })();
    });
    return () => sub.unsubscribe();
  }, [activeAgent?.conversationId]);

  const openFile = async (relPath: string) => {
    setSelectedPath(relPath);
    setContextTab("preview");
    setKnownFiles((prev) => (prev.includes(relPath) ? prev : [...prev, relPath]));
    setPreviewLoading(true);
    const backend = createPortalShellWorkspaceBackend();
    if (!backend || !workspaceRoot) {
      setPreviewText("");
      setPreviewLoading(false);
      setError("无工作区或 FS backend");
      return;
    }
    const sandbox = new WorkspaceSandbox(workspaceRoot, backend);
    const out = await sandbox.readTextRel(relPath);
    setPreviewLoading(false);
    if (!out.ok) {
      setPreviewText("");
      setError(out.error);
      return;
    }
    setError(null);
    setPreviewText(out.text);
  };

  const createLockedSession = (workspaceRootValue: string | null) => {
    const s = createAgentSession({ workspaceRoot: workspaceRootValue });
    setAgents((prev) => {
      const remembered =
        workspaceRootValue == null || workspaceRootValue === ""
          ? prev
          : rememberWorkspace(prev, workspaceRootValue);
      return {
        sessions: [...remembered.sessions, s],
        activeSessionId: s.id,
        knownWorkspaces: remembered.knownWorkspaces,
      };
    });
    setNewAgentOpen(false);
  };

  const searchActions: SearchAction[] = useMemo(
    () => [
      {
        id: "new-agent",
        label: "新建 Agent",
        hint: "锁定工作区或无工作区",
        run: () => setNewAgentOpen(true),
      },
      {
        id: "tab-terminals",
        label: "打开 Terminals",
        run: () => setContextTab("terminals"),
      },
      {
        id: "tab-files",
        label: "打开 Files",
        run: () => setContextTab("files"),
      },
    ],
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="coding-app coding-agent-window">
      <header className="coding-toolbar">
        <div className="coding-brand">Agent Window</div>
        <span className="muted coding-toolbar-hint">一对话一根工作区 · 创建后不可变</span>
        <div className="coding-attach" title="remote tools attach">
          <span className={attach.remote_tools_connected ? "dot on" : "dot"} />
          {attach.remote_tools_connected
            ? "Outpost 已连接"
            : window.portalShell?.remoteAuth?.token
              ? "Outpost 连接中…"
              : "Outpost 未连接（需主窗配置 Habitat Token）"}
          {attach.instance_id ? (
            <code className="coding-instance">instance_id={attach.instance_id}</code>
          ) : null}
        </div>
        {project ? (
          <div className="coding-project">
            <span>{project.display_name ?? project.stable_key}</span>
            <code>{project.stable_key}</code>
          </div>
        ) : null}
      </header>

      {error ? <div className="coding-error">{error}</div> : null}
      {sessionError ? <div className="coding-error">会话：{sessionError}</div> : null}

      <main className="coding-main">
        <AgentSessionSidebar
          sessions={agents.sessions}
          activeSessionId={agents.activeSessionId}
          onSelect={(id) => setAgents((prev) => ({ ...prev, activeSessionId: id }))}
          onNew={() => setNewAgentOpen(true)}
          onArchive={(id) => setAgents((prev) => archiveSession(prev, id))}
          onDelete={(id) => setAgents((prev) => removeSession(prev, id))}
          onOpenSearch={() => setSearchOpen(true)}
        />

        <AgentChatPane
          sessionKey={activeAgent?.id ?? "none"}
          conversationId={activeAgent?.conversationId ?? null}
          {...(sessionMeta?.agent_subject_id != null
            ? { agentSubjectId: sessionMeta.agent_subject_id }
            : {})}
          disabled={!attach.instance_id && !window.portalShell?.remoteAuth?.token}
          onNeedConversation={bindConversation}
          onAgentSubjectChange={(agentSubjectId) => {
            setSessionMeta((prev) => (prev ? { ...prev, agent_subject_id: agentSubjectId } : prev));
          }}
          onTitleHint={(text) => {
            if (!activeAgent) return;
            const title = text.slice(0, 40).trim();
            if (!title) return;
            setAgents((prev) => {
              const cur = getActiveSession(prev);
              if (!cur || cur.id !== activeAgent.id) return prev;
              if (cur.title !== defaultTitle(cur.workspaceRoot)) return prev;
              return upsertSession(prev, patchSessionMeta(cur, { title }));
            });
          }}
        />

        <ContextPanel
          tab={contextTab}
          onTabChange={setContextTab}
          badge={{
            terminals: termCount,
          }}
        >
          {contextTab === "files" ? (
            <div className="coding-context-files">
              {workspaceRoot ? (
                <>
                  <p className="coding-active-root muted" title={workspaceRoot}>
                    {workspaceRoot}
                  </p>
                  <WorkspaceFileTree
                    treeKey={`${activeAgent?.id ?? ""}:${workspaceRoot}`}
                    listChildren={listTreeChildren}
                    selectedPath={selectedPath}
                    onSelectFile={(path) => void openFile(path)}
                  />
                </>
              ) : (
                <p className="muted">本会话无工作区（创建时已锁定）。换目录请新建 Agent。</p>
              )}
              {sessionMeta?.project_world_id != null ? (
                <div className="coding-notes">
                  <h3>理解笔记</h3>
                  <input
                    className="coding-path-input"
                    value={noteTitle}
                    placeholder="笔记标题"
                    onChange={(e) => setNoteTitle(e.target.value)}
                  />
                  <textarea
                    className="coding-patch-ta"
                    value={noteBody}
                    placeholder="探索/理解笔记正文"
                    rows={3}
                    onChange={(e) => setNoteBody(e.target.value)}
                  />
                  <button
                    type="button"
                    className="coding-btn"
                    onClick={() => {
                      const worldId = sessionMeta.project_world_id;
                      if (worldId == null) return;
                      const title = noteTitle.trim();
                      if (!title) {
                        setNoteStatus("标题不能为空");
                        return;
                      }
                      void createProjectCodingNote({
                        worldId,
                        title,
                        content: noteBody,
                        kind: "explore",
                      })
                        .then((r) => {
                          setNoteStatus(`已写入 coding_note #${r.id}`);
                          setNoteTitle("");
                          setNoteBody("");
                        })
                        .catch((e) => {
                          setNoteStatus(e instanceof Error ? e.message : String(e));
                        });
                    }}
                  >
                    保存到项目 World
                  </button>
                  {noteStatus ? <p className="muted">{noteStatus}</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {contextTab === "preview" ? (
            <div className="coding-context-preview">
              <h3>{selectedPath ? selectedPath : "预览"}</h3>
              <CodePreview path={selectedPath} text={previewText} loading={previewLoading} />
            </div>
          ) : null}
          {contextTab === "terminals" ? <TerminalLogPanel /> : null}
        </ContextPanel>
      </main>

      <NewAgentDialog
        open={newAgentOpen}
        onClose={() => setNewAgentOpen(false)}
        workspaceRoots={knownWorkspaceRoots}
        onSelectWorkspace={(root) => createLockedSession(root)}
        onNoWorkspace={() => createLockedSession(null)}
        onPickFolder={() => {
          void pickWorkspacePath()
            .then((p) => {
              if (!p) return;
              createLockedSession(p);
            })
            .catch((e) => setError(e instanceof Error ? e.message : String(e)));
        }}
      />

      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        sessions={agents.sessions}
        activeSession={activeAgent}
        filePaths={knownFiles}
        actions={searchActions}
        onSelectSession={(id) => setAgents((prev) => ({ ...prev, activeSessionId: id }))}
        onSelectFile={(path) => void openFile(path)}
      />
    </div>
  );
}
