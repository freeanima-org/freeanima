import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { SessionMessagePanel } from "@/components/chamber/SessionMessagePanel.tsx";
import { AcpProgressDock } from "@/components/AcpProgressDock.tsx";
import { useAcpProgressDock } from "@/hooks/useAcpProgressDock.ts";
import { m } from "@/lib/i18n.ts";
import { useChamberSessionsStore } from "@/stores/chamber-sessions.ts";

export const Route = createFileRoute("/chamber/sessions/$sessionId")({
  component: SessionDetailPage,
});

function formatCreated(iso: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
    return d.toLocaleString("zh-CN", { hour12: false });
  } catch {
    return iso.slice(0, 16);
  }
}

function SessionDetailPage() {
  const { sessionId } = Route.useParams();
  const store = useChamberSessionsStore();
  const session = store.findSession(sessionId);

  const acpDock = useAcpProgressDock(sessionId, {
    onDecision: async (sid) => {
      await useChamberSessionsStore.getState().selectSession(sid, store.currentPage());
    },
  });

  useEffect(() => {
    const state = useChamberSessionsStore.getState();
    if (!state.sessions.length && !state.loadingSessions) {
      void state.fetchSessions();
    }
  }, []);

  useEffect(() => {
    void useChamberSessionsStore.getState().selectSession(sessionId, 1);
  }, [sessionId]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Link to="/chamber/sessions" className="btn btn-ghost btn-xs">
          {m.webui_chamber_sessions_back_list()}
        </Link>
        <h2 className="text-lg font-bold flex-1 truncate">
          {session?.title || m.webui_common_no_title()}
        </h2>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4 text-xs text-base-content/60">
        <span className="badge badge-ghost badge-xs">{session?.platform || "legacy"}</span>
        {session?.created ? <span>{formatCreated(session.created)}</span> : null}
        <span className="font-mono break-all">{sessionId}</span>
      </div>

      <div className="card bg-base-200">
        <div className="card-body">
          {acpDock ? (
            <div className="mb-3">
              <AcpProgressDock dock={acpDock} />
            </div>
          ) : null}
          <SessionMessagePanel
            items={store.display}
            total={store.total}
            currentPage={store.currentPage()}
            pageCount={store.pageCount()}
            pageSize={store.limit}
            pageOffset={store.offset}
            loading={store.loadingMessages}
            onPageChange={(p) => void store.goToPage(p)}
          />
        </div>
      </div>

      {store.error ? <div className="alert alert-error text-sm mt-4">{store.error}</div> : null}
    </div>
  );
}
