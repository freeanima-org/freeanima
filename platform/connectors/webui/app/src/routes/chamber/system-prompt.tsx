import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { PromptDebugResponse } from "@freeanima/platform/connectors/webui/api";
import { useEffect, useMemo, useState } from "react";
import { getPromptDebug } from "@/lib/api.ts";
import { m } from "@/lib/i18n.ts";
import { useChamberSessionsStore } from "@/stores/chamber-sessions.ts";

type TabId = "parts" | "full" | "tools";

const PART_KEYS = ["self", "toolsets", "resident", "agents"] as const;
type PartKey = (typeof PART_KEYS)[number];

const PART_BREAKDOWN_KEY = {
  self: "system_self",
  toolsets: "system_toolsets",
  resident: "system_resident",
  agents: "system_agents",
} as const;

function partLabel(key: PartKey): string {
  if (key === "self") return m.webui_chamber_system_prompt_block_self();
  if (key === "toolsets") return m.webui_chamber_system_prompt_block_toolsets();
  if (key === "resident") return m.webui_chamber_system_prompt_block_resident();
  return m.webui_chamber_system_prompt_block_agents();
}

function formatTokenK(tokens: number): string {
  if (tokens <= 0) return "0";
  if (tokens < 1000) return `${tokens}`;
  const k = tokens / 1000;
  return k >= 10 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`;
}

function estimateChars(text: string): number {
  return text.length;
}

export const Route = createFileRoute("/chamber/system-prompt")({
  validateSearch: (search: Record<string, unknown>): { session?: string } => ({
    session: typeof search.session === "string" && search.session ? search.session : undefined,
  }),
  component: SystemPromptPage,
});

function ToolSchemaCard({ tool }: { tool: PromptDebugResponse["tools"]["items"][number] }) {
  return (
    <div className="card bg-base-200">
      <div className="card-body py-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-mono text-sm font-bold break-all">{tool.name}</h3>
          {tool.toolset ? (
            <span className="badge badge-ghost badge-xs shrink-0">{tool.toolset}</span>
          ) : null}
        </div>
        {tool.description ? (
          <p className="text-xs text-base-content/60">{tool.description}</p>
        ) : null}
        <details className="mt-1">
          <summary className="text-xs cursor-pointer text-base-content/50">
            {m.webui_chamber_tools_param_schema()}
          </summary>
          <pre className="text-xs mt-1 bg-base-300 p-2 rounded overflow-x-auto">
            {JSON.stringify(tool.parameters, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}

function BreakdownBar({ data }: { data: PromptDebugResponse["system"]["breakdown"] }) {
  const systemTotal =
    data.system_self + data.system_agents + data.system_resident + data.system_toolsets;
  return (
    <div className="card bg-base-200">
      <div className="card-body py-3 px-4 gap-2">
        <h3 className="text-sm font-semibold">{m.webui_chamber_system_prompt_token_breakdown()}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div>
            <span className="text-base-content/50">
              {m.webui_chamber_system_prompt_token_system()}
            </span>
            <div className="font-mono">~{formatTokenK(systemTotal)}</div>
          </div>
          <div>
            <span className="text-base-content/50">
              {m.webui_chamber_system_prompt_token_messages()}
            </span>
            <div className="font-mono">~{formatTokenK(data.messages)}</div>
          </div>
          <div>
            <span className="text-base-content/50">
              {m.webui_chamber_system_prompt_token_tools()}
            </span>
            <div className="font-mono">~{formatTokenK(data.tools)}</div>
          </div>
          <div>
            <span className="text-base-content/50">
              {m.webui_chamber_system_prompt_token_total()}
            </span>
            <div className="font-mono font-semibold">~{formatTokenK(data.total)}</div>
          </div>
        </div>
        {(data.system_self > 0 ||
          data.system_toolsets > 0 ||
          data.system_agents > 0 ||
          data.system_resident > 0) && (
          <div className="flex flex-wrap gap-2 text-xs text-base-content/60">
            {data.system_self > 0 ? (
              <span>
                {m.webui_chamber_system_prompt_block_self()} ~{formatTokenK(data.system_self)}
              </span>
            ) : null}
            {data.system_toolsets > 0 ? (
              <span>
                {m.webui_chamber_system_prompt_block_toolsets()} ~
                {formatTokenK(data.system_toolsets)}
              </span>
            ) : null}
            {data.system_resident > 0 ? (
              <span>
                {m.webui_chamber_system_prompt_block_resident()} ~
                {formatTokenK(data.system_resident)}
              </span>
            ) : null}
            {data.system_agents > 0 ? (
              <span>
                {m.webui_chamber_system_prompt_block_agents()} ~{formatTokenK(data.system_agents)}
              </span>
            ) : null}
            {data.summary > 0 ? (
              <span>
                {m.webui_chamber_system_prompt_block_summary()} ~{formatTokenK(data.summary)}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function SystemPromptPage() {
  const { session: sessionFromUrl } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const sessionsStore = useChamberSessionsStore();
  const [tab, setTab] = useState<TabId>("parts");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<PromptDebugResponse | null>(null);
  const [toolQuery, setToolQuery] = useState("");
  const [copyHint, setCopyHint] = useState("");

  const selectedSession = sessionFromUrl ?? "";

  useEffect(() => {
    const state = useChamberSessionsStore.getState();
    if (!state.sessions.length && !state.loadingSessions) {
      void state.fetchSessions();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void getPromptDebug(selectedSession || undefined)
      .then((result) => {
        if (!cancelled) setData(result as PromptDebugResponse);
      })
      .catch((e) => {
        if (!cancelled) {
          setData(null);
          setError(String(e));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSession]);

  const sortedSessions = sessionsStore.sortedSessions();

  const filteredTools = useMemo(() => {
    const items = data?.tools.items ?? [];
    const q = toolQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.toolset?.toLowerCase().includes(q) ?? false),
    );
  }, [data?.tools.items, toolQuery]);

  const handleSessionChange = (value: string) => {
    void navigate({
      search: value ? { session: value } : {},
    });
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyHint(m.webui_common_copied({ label }));
      setTimeout(() => setCopyHint(""), 2000);
    } catch {
      setCopyHint(m.webui_common_copy_failed({ label: "" }));
      setTimeout(() => setCopyHint(""), 2000);
    }
  };

  const toolsMode =
    data?.tools.mode === "registry"
      ? m.webui_chamber_system_prompt_tools_registry()
      : m.webui_chamber_system_prompt_tools_effective();

  return (
    <div>
      <h2 className="text-lg font-bold mb-1">{m.webui_chamber_nav_system_prompt()}</h2>
      <p className="text-sm text-base-content/60 mb-4">{m.webui_chamber_system_prompt_desc()}</p>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="form-control w-full max-w-xl">
          <span className="label-text text-xs mb-1">
            {m.webui_chamber_system_prompt_session_optional()}
          </span>
          <select
            className="select select-bordered select-sm w-full font-mono text-xs"
            value={selectedSession}
            onChange={(e) => handleSessionChange(e.target.value)}
          >
            <option value="">{m.webui_common_global_template()}</option>
            {sortedSessions.map((s) => (
              <option key={s.id} value={s.id}>
                {(s.title || m.webui_common_no_title()).slice(0, 24)} · {s.id.slice(0, 20)}…
              </option>
            ))}
          </select>
        </label>
        {selectedSession ? (
          <Link
            to="/chamber/sessions/$sessionId"
            params={{ sessionId: selectedSession }}
            className="btn btn-ghost btn-xs"
          >
            {m.webui_chamber_system_prompt_session_detail()}
          </Link>
        ) : null}
        <Link to="/chamber/self-layer" className="btn btn-ghost btn-xs">
          {m.webui_chamber_system_prompt_self_layer()}
        </Link>
        <Link to="/chamber/tools" className="btn btn-ghost btn-xs">
          {m.webui_chamber_system_prompt_tools_list()}
        </Link>
      </div>

      {loading ? (
        <div className="text-sm text-base-content/60">{m.webui_common_loading()}</div>
      ) : null}
      {error ? <div className="alert alert-error text-sm">{error}</div> : null}

      {data && !loading ? (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="badge badge-ghost badge-sm">
              {data.mode === "global"
                ? m.webui_chamber_system_prompt_mode_global()
                : m.webui_chamber_system_prompt_mode_session()}
            </span>
            <span className="badge badge-ghost badge-sm">
              {m.webui_chamber_system_prompt_tools_count({
                count: String(data.tools.count),
                mode: toolsMode,
              })}
            </span>
            {data.mode === "session" && data.system.in_sync !== undefined ? (
              <span
                className={`badge badge-sm ${data.system.in_sync ? "badge-success" : "badge-warning"}`}
              >
                {data.system.in_sync
                  ? m.webui_common_stored_live_sync()
                  : m.webui_common_stored_live_diff()}
              </span>
            ) : null}
            {copyHint ? <span className="text-xs text-success">{copyHint}</span> : null}
          </div>

          {data.meta ? (
            <div className="text-xs text-base-content/60 mb-4 space-y-1">
              {data.meta.cwd ? (
                <div>
                  cwd: <code className="text-xs">{data.meta.cwd}</code>
                </div>
              ) : null}
              {data.meta.capability_mask?.presets.length ? (
                <div>capability_mask: {data.meta.capability_mask.presets.join(", ")}</div>
              ) : null}
              {data.meta.tool_names?.length ? (
                <div>
                  {m.webui_chamber_system_prompt_meta_tools({
                    count: String(data.meta.tool_names.length),
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mb-4">
            <BreakdownBar data={data.system.breakdown} />
          </div>

          <div role="tablist" className="tabs tabs-boxed tabs-sm mb-4 w-fit">
            {(
              [
                ["parts", m.webui_chamber_system_prompt_tab_parts()],
                ["full", m.webui_chamber_system_prompt_tab_full()],
                ["tools", m.webui_chamber_system_prompt_tab_tools()],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                className={`tab ${tab === id ? "tab-active" : ""}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "parts" ? (
            <div className="space-y-4">
              {PART_KEYS.map((key) => {
                const text = data.system.parts[key];
                return (
                  <details key={key} className="group card bg-base-200" open>
                    <summary className="cursor-pointer list-none card-body py-3 px-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-sm">{partLabel(key)}</h3>
                        <span className="text-xs text-base-content/50">
                          {m.webui_common_chars_estimate({
                            chars: String(estimateChars(text)),
                            tokens: formatTokenK(data.system.breakdown[PART_BREAKDOWN_KEY[key]]),
                          })}
                        </span>
                      </div>
                    </summary>
                    <div className="px-4 pb-4">
                      <pre className="text-xs whitespace-pre-wrap bg-base-300 p-3 rounded max-h-96 overflow-auto">
                        {text.trim() || m.webui_common_empty()}
                      </pre>
                    </div>
                  </details>
                );
              })}
            </div>
          ) : null}

          {tab === "full" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  onClick={() => void copyText(data.system.composed, " live prompt")}
                >
                  {m.webui_chamber_system_prompt_copy_live()}
                </button>
                {data.system.stored != null ? (
                  <button
                    type="button"
                    className="btn btn-outline btn-xs"
                    onClick={() => void copyText(data.system.stored ?? "", " stored prompt")}
                  >
                    {m.webui_chamber_system_prompt_copy_stored()}
                  </button>
                ) : null}
              </div>
              {data.mode === "session" && data.system.stored != null ? (
                <div className="grid lg:grid-cols-2 gap-4">
                  <section>
                    <h3 className="text-sm font-semibold mb-2">
                      {m.webui_chamber_system_prompt_live()}
                    </h3>
                    <pre className="text-xs whitespace-pre-wrap bg-base-300 p-3 rounded max-h-[32rem] overflow-auto">
                      {data.system.composed || m.webui_common_empty()}
                    </pre>
                  </section>
                  <section>
                    <h3 className="text-sm font-semibold mb-2">
                      {m.webui_chamber_system_prompt_stored()}
                    </h3>
                    <pre className="text-xs whitespace-pre-wrap bg-base-300 p-3 rounded max-h-[32rem] overflow-auto">
                      {data.system.stored || m.webui_common_empty()}
                    </pre>
                  </section>
                </div>
              ) : (
                <pre className="text-xs whitespace-pre-wrap bg-base-300 p-3 rounded max-h-[32rem] overflow-auto">
                  {data.system.composed || m.webui_common_empty()}
                </pre>
              )}
            </div>
          ) : null}

          {tab === "tools" ? (
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <input
                  type="search"
                  className="input input-bordered input-sm w-full max-w-sm"
                  placeholder={m.webui_chamber_system_prompt_search_tools()}
                  value={toolQuery}
                  onChange={(e) => setToolQuery(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  onClick={() =>
                    void copyText(JSON.stringify(data.tools.items, null, 2), " tool schema JSON")
                  }
                >
                  {m.webui_chamber_system_prompt_copy_json()}
                </button>
                <span className="text-xs text-base-content/50">
                  {m.webui_chamber_system_prompt_tools_shown({
                    shown: String(filteredTools.length),
                    total: String(data.tools.count),
                    tokens: formatTokenK(data.tools.tokens_est),
                  })}
                </span>
              </div>
              <div className="space-y-2">
                {filteredTools.map((tool) => (
                  <ToolSchemaCard key={tool.name} tool={tool} />
                ))}
                {!filteredTools.length ? (
                  <div className="text-sm text-base-content/50">
                    {m.webui_chamber_system_prompt_no_tools()}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
