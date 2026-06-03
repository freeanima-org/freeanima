import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSessionsStore } from "@/stores/sessions";

export const Route = createFileRoute("/parlor/sessions")({
  component: SessionsPage,
});

function formatTime(id: string) {
  const p = id.split("_");
  if (p.length >= 2) {
    return `${p[0].slice(0, 4)}-${p[0].slice(4, 6)}-${p[0].slice(6)} ${p[1].slice(0, 2)}:${p[1].slice(2, 4)}:${p[1].slice(4, 6)}`;
  }
  return id;
}

function SessionsPage() {
  const sessions = useSessionsStore((s) => s.sessions);
  const navigate = useNavigate();

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">会话管理</h2>
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>标题</th>
              <th>会话 ID</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td className="font-medium">{s.title || "（无标题）"}</td>
                <td className="font-mono text-xs">{s.id}</td>
                <td>{formatTime(s.id)}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() =>
                      void navigate({
                        to: "/parlor/chat",
                        search: { session: s.id },
                      })
                    }
                  >
                    打开
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
