import type { ConversationAcpDockSnapshot } from "@chat/lib/types.ts";

type AcpProgressDockProps = {
  dock: ConversationAcpDockSnapshot;
};

function statusLabel(status: string): string {
  if (status === "awaiting_decision") return "需要决策";
  if (status === "queued") return "排队中";
  return "运行中";
}

export function AcpProgressDock({ dock }: AcpProgressDockProps) {
  const decision = dock.highlight_decision;
  const taskProgress = dock.task_progress ?? {};

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
            {t.agent_name} · {statusLabel(t.status)}
          </span>
        ))}
      </div>
      {decision ? (
        <p className="text-warning font-medium">
          Cursor 等待决策，请查看会话消息并使用 acp_conversation_id 续聊。
        </p>
      ) : null}
      {Object.keys(taskProgress).length > 0 ? (
        <div className="mt-1 space-y-2 max-h-48 overflow-y-auto">
          {Object.entries(taskProgress).map(([taskId, text]) => (
            <pre key={taskId} className="whitespace-pre-wrap text-xs opacity-90 font-mono">
              {`[${taskId}]\n${text}`}
            </pre>
          ))}
        </div>
      ) : dock.progress_text ? (
        <pre className="whitespace-pre-wrap text-xs opacity-90 max-h-40 overflow-y-auto mt-1 font-mono">
          {dock.progress_text}
        </pre>
      ) : null}
    </div>
  );
}
