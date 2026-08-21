import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchHabitatConfigSection } from "@freeanima/client/portal-sdk/habitat-config-api.ts";
import { loadResolvedWorldContext } from "@freeanima/client/portal-sdk/world-context.ts";
import { asRecord } from "@freeanima/shared/util";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@freeanima/ui-kit";
import { listSubjectEntities } from "@freeanima/features/habitat/ui/habitat/lib/api.ts";

const OBSERVER_AGENT_STORAGE_KEY = "freeanima.observer.agentSubjectId";
const LEGACY_STORAGE_KEY = "freeanima.habitat.observerAgentSubjectId";

export type ObserverAgentOption = {
  id: number;
  title: string;
};

type ObserverAgentContextValue = {
  agentSubjectId: number | null;
  setAgentSubjectId: (id: number) => void;
  agents: ObserverAgentOption[];
  ready: boolean;
};

const ObserverAgentContext = createContext<ObserverAgentContextValue | null>(null);

function positiveInt(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

function readStoredAgentSubjectId(): number | undefined {
  try {
    const next = positiveInt(localStorage.getItem(OBSERVER_AGENT_STORAGE_KEY));
    if (next != null) return next;
    return positiveInt(localStorage.getItem(LEGACY_STORAGE_KEY));
  } catch {
    return undefined;
  }
}

function writeStoredAgentSubjectId(id: number): void {
  try {
    localStorage.setItem(OBSERVER_AGENT_STORAGE_KEY, String(id));
  } catch {
    /* ignore quota / private mode */
  }
}

/** 默认聊天 Anima：优先 worlds.context，其次 config chat.default_agent_subject_id。 */
async function resolveDefaultChatAgentSubjectId(): Promise<number | undefined> {
  try {
    const ctx = await loadResolvedWorldContext();
    const fromCtx = positiveInt(ctx.default_chat_agent_subject_id ?? ctx.agent_subject_id);
    if (fromCtx != null) return fromCtx;
  } catch {
    /* Habitat 未就绪时再试 config */
  }
  try {
    const section = await fetchHabitatConfigSection("chat");
    const rec = asRecord(section);
    return positiveInt(rec?.default_agent_subject_id);
  } catch {
    return undefined;
  }
}

function parseAgentSubjects(raw: {
  items: Array<{ id: number; type?: string; title?: string }>;
}): ObserverAgentOption[] {
  const out: ObserverAgentOption[] = [];
  for (const row of raw.items) {
    if (row.type !== "agent") continue;
    const id = positiveInt(row.id);
    if (id == null) continue;
    out.push({ id, title: typeof row.title === "string" ? row.title.trim() : "" });
  }
  return out;
}

function pickInitialAgentId(
  agents: ObserverAgentOption[],
  stored: number | undefined,
  fallback: number | undefined,
): number | null {
  if (stored != null && agents.some((a) => a.id === stored)) return stored;
  if (fallback != null && agents.some((a) => a.id === fallback)) return fallback;
  if (fallback != null) return fallback;
  return agents[0]?.id ?? null;
}

export function ObserverAgentProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<ObserverAgentOption[]>([]);
  const [agentSubjectId, setAgentSubjectIdState] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [subjects, defaultId] = await Promise.all([
          listSubjectEntities({ limit: 500 }),
          resolveDefaultChatAgentSubjectId(),
        ]);
        if (cancelled) return;
        const nextAgents = parseAgentSubjects(subjects);
        const initial = pickInitialAgentId(nextAgents, readStoredAgentSubjectId(), defaultId);
        setAgents(nextAgents);
        setAgentSubjectIdState(initial);
        if (initial != null) writeStoredAgentSubjectId(initial);
      } catch {
        if (cancelled) return;
        setAgents([]);
        setAgentSubjectIdState(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setAgentSubjectId = useCallback((id: number) => {
    if (!Number.isInteger(id) || id <= 0) return;
    setAgentSubjectIdState(id);
    writeStoredAgentSubjectId(id);
  }, []);

  const value = useMemo(
    (): ObserverAgentContextValue => ({
      agentSubjectId,
      setAgentSubjectId,
      agents,
      ready,
    }),
    [agentSubjectId, setAgentSubjectId, agents, ready],
  );

  return <ObserverAgentContext.Provider value={value}>{children}</ObserverAgentContext.Provider>;
}

export function useObserverAgent(): ObserverAgentContextValue {
  const ctx = useContext(ObserverAgentContext);
  if (!ctx) {
    throw new Error("useObserverAgent must be used within ObserverAgentProvider");
  }
  return ctx;
}

/** 当前卧室所选 Anima 的 subject id；未就绪时为 null。 */
export function useObserverAgentSubjectId(): number | null {
  return useObserverAgent().agentSubjectId;
}

function formatAgentLabel(id: number, title: string): string {
  const trimmed = title.trim();
  return trimmed || `#${id}`;
}

/** 卧室顶栏：选择这间卧室对应的 Anima。 */
export function ObserverAgentSelect({ className }: { className?: string }) {
  const { agentSubjectId, setAgentSubjectId, agents, ready } = useObserverAgent();
  const selectedKey = agentSubjectId != null ? String(agentSubjectId) : null;
  const options =
    agentSubjectId != null && !agents.some((a) => a.id === agentSubjectId)
      ? [{ id: agentSubjectId, title: `#${agentSubjectId}` }, ...agents]
      : agents;

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <span className="shrink-0 text-sm text-muted-foreground">Anima</span>
      <Select
        selectedKey={selectedKey}
        isDisabled={!ready || options.length === 0}
        aria-label="选择卧室 Anima"
        onSelectionChange={(key) => {
          if (key == null) return;
          const id = Number(String(key));
          if (!Number.isInteger(id) || id <= 0) return;
          if (id === agentSubjectId) return;
          setAgentSubjectId(id);
        }}
      >
        <SelectTrigger size="sm" className="min-w-0 max-w-56">
          <SelectValue placeholder={ready ? "选择 Anima" : "加载中…"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((a) => (
            <SelectItem key={a.id} id={String(a.id)}>
              {formatAgentLabel(a.id, a.title)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
