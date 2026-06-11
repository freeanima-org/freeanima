import type { SessionAcpDockSnapshot } from "@/lib/api.ts";

type AcpProgressDockProps = {
  dock: SessionAcpDockSnapshot;
};

export function AcpProgressDock({ dock }: AcpProgressDockProps) {
  const decision = dock.highlight_decision;
  const primary = dock.tasks[0];

  return (
    <div
      className={`rounded-lg border px-3 py-2 text-sm shadow-sm ${
        decision
          ? "border-warning bg-warning/10 text-warning-content"
          : "border-primary/30 bg-base-200/80"
      }`}
      data-testid="acp-progress-dock"
    >
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <span className="font-semibold">Cursor ACP</span>
        {dock.tasks.map((t) => (
          <span key={t.task_id} className="badge badge-sm badge-outline font-mono">
            {t.agent_name} · {t.status === "awaiting_decision" ? "需要决策" : "运行中"}
          </span>
        ))}
      </div>
      {decision ? (
        <p className="text-warning font-medium">
          Cursor 等待决策，请查看会话消息并 continue_session。
        </p>
      ) : null}
      {dock.progress_text ? (
        <pre className="whitespace-pre-wrap text-xs opacity-90 max-h-40 overflow-y-auto mt-1 font-mono">
          {dock.progress_text}
        </pre>
      ) : primary ? (
        <p className="text-xs opacity-70">task {primary.task_id} · 等待进度…</p>
      ) : null}
    </div>
  );
}
