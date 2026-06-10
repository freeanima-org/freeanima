import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { m } from "@/lib/i18n.ts";
import { useSessionsStore } from "@/stores/sessions.ts";

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
      <h2 className="text-lg font-bold mb-4">{m.webui_parlor_sessions_title()}</h2>
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>{m.webui_parlor_sessions_col_title()}</th>
              <th>{m.webui_parlor_sessions_col_id()}</th>
              <th>{m.webui_parlor_sessions_col_created()}</th>
              <th>{m.webui_parlor_sessions_col_actions()}</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td className="font-medium">{s.title || m.webui_common_no_title()}</td>
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
                    {m.webui_parlor_sessions_open()}
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
