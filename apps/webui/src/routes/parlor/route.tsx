import { createFileRoute, Outlet, useNavigate, useSearch } from "@tanstack/react-router";
import type { SessionListItem } from "@freeanima/legacy-api";
import { useEffect, useRef, useState } from "react";
import { ResponsiveSidebarLayout } from "@/components/ResponsiveSidebarLayout";
import { useSessionsStore } from "@/stores/sessions";

export const Route = createFileRoute("/parlor")({
  component: ParlorLayout,
});

function sessionLabel(item: SessionListItem) {
  const id = item.id;
  const title = item.title || "";
  if (title) return title;
  const p = id.split("_");
  if (p.length >= 2) {
    return `${p[0].slice(0, 4)}-${p[0].slice(4, 6)}-${p[0].slice(6)} ${p[1].slice(0, 2)}:${p[1].slice(2, 4)}`;
  }
  return id;
}

function ParlorLayout() {
  const sessions = useSessionsStore((s) => s.sessions);
  const currentId = useSessionsStore((s) => s.currentId);
  const fetchSessions = useSessionsStore((s) => s.fetchSessions);
  const selectSession = useSessionsStore((s) => s.selectSession);
  const newSessionFn = useSessionsStore((s) => s.newSession);
  const renameSession = useSessionsStore((s) => s.renameSession);

  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { session?: string };
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    sessionId: null as string | null,
  });
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameText, setRenameText] = useState("");

  const navigateToChat = (sessionId: string) => {
    void navigate({ to: "/parlor/chat", search: { session: sessionId } });
  };

  const syncFromRoute = async (sessionId?: string) => {
    const list = await fetchSessions();
    if (sessionId) {
      if (sessionId !== currentId) await selectSession(sessionId);
      return;
    }
    if (list.length === 0) return;
    const id = currentId || list[0]?.id;
    if (!id) return;
    await selectSession(id);
    void navigate({ to: "/parlor/chat", search: { session: id }, replace: true });
  };

  useEffect(() => {
    void syncFromRoute(search.session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (search.session && search.session !== currentId) {
      void selectSession(search.session);
    }
  }, [search.session, currentId, selectSession]);

  useEffect(() => {
    const close = () => setContextMenu((m) => ({ ...m, visible: false }));
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const newSession = async () => {
    const id = await newSessionFn();
    if (id) navigateToChat(id);
  };

  const selectSessionItem = (item: SessionListItem, close?: () => void) => {
    navigateToChat(item.id);
    close?.();
  };

  const startRename = () => {
    const s = sessions.find((x) => x.id === contextMenu.sessionId);
    setRenameText((s && s.title) || "");
    setShowRenameDialog(true);
    setContextMenu((m) => ({ ...m, visible: false }));
    requestAnimationFrame(() => renameInputRef.current?.focus());
  };

  const confirmRename = async () => {
    const title = renameText.trim();
    if (title && contextMenu.sessionId) {
      await renameSession(contextMenu.sessionId, title);
    }
    setShowRenameDialog(false);
    setRenameText("");
  };

  return (
    <ResponsiveSidebarLayout
      title="会客厅"
      subtitle="Parlor"
      showSidebarHeader={false}
      mobileActions={
        <button type="button" className="btn btn-primary btn-sm" onClick={() => void newSession()}>
          ＋
        </button>
      }
      sidebar={({ close }) => (
        <>
          <div className="p-2">
            <button
              type="button"
              className="btn btn-primary btn-sm w-full"
              onClick={() => void newSession()}
            >
              ＋ 新会话
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={[
                  "session-item cursor-pointer relative",
                  s.id === currentId ? "sidebar-nav-active" : "",
                ].join(" ")}
                onClick={() => selectSessionItem(s, close)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({
                    visible: true,
                    x: e.clientX,
                    y: e.clientY,
                    sessionId: s.id,
                  });
                }}
              >
                <div className="truncate">{sessionLabel(s)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    >
      <Outlet />

      {contextMenu.visible ? (
        <div
          className="fixed z-50 bg-base-100 border border-base-300 rounded-lg shadow-xl py-1 min-w-[140px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div
            className="px-3 py-1.5 hover:bg-base-300 cursor-pointer text-sm"
            onClick={startRename}
          >
            ✏️ 重命名
          </div>
        </div>
      ) : null}

      {showRenameDialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowRenameDialog(false)}
        >
          <div
            className="bg-base-100 rounded-xl p-5 shadow-2xl w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold mb-3">修改标题</h3>
            <input
              ref={renameInputRef}
              value={renameText}
              onChange={(e) => setRenameText(e.target.value)}
              type="text"
              className="input input-bordered w-full text-sm"
              placeholder="输入新标题"
              onKeyDown={(e) => {
                if (e.key === "Enter") void confirmRename();
                if (e.key === "Escape") setShowRenameDialog(false);
              }}
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowRenameDialog(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => void confirmRename()}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ResponsiveSidebarLayout>
  );
}
