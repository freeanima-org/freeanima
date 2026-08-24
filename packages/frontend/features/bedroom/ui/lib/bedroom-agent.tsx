import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@freeanima/ui-kit";
import { listSubjectEntities } from "@freeanima/features/habitat/ui/habitat/lib/api.ts";

const BEDROOM_AGENT_STORAGE_KEY = "freeanima.bedroom.agentSubjectId";
/** 旧卧室 Anima 选择键（只读兼容） */
const LEGACY_OBSERVER_STORAGE_KEY = "freeanima.observer.agentSubjectId";
const LEGACY_HABITAT_STORAGE_KEY = "freeanima.habitat.observerAgentSubjectId";

export type BedroomAgentOption = {
  id: number;
  title: string;
};

type BedroomAgentContextValue = {
  agentSubjectId: number | null;
  setAgentSubjectId: (id: number) => void;
  agents: BedroomAgentOption[];
  ready: boolean;
};

const BedroomAgentContext = createContext<BedroomAgentContextValue | null>(null);

function positiveInt(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

function readStoredAgentSubjectId(): number | undefined {
  try {
    for (const key of [
      BEDROOM_AGENT_STORAGE_KEY,
      LEGACY_OBSERVER_STORAGE_KEY,
      LEGACY_HABITAT_STORAGE_KEY,
    ]) {
      const next = positiveInt(localStorage.getItem(key));
      if (next != null) return next;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function writeStoredAgentSubjectId(id: number): void {
  try {
    localStorage.setItem(BEDROOM_AGENT_STORAGE_KEY, String(id));
  } catch {
    /* ignore quota / private mode */
  }
}

function parseAgentSubjects(raw: {
  items: Array<{ id: number; type?: string; title?: string }>;
}): BedroomAgentOption[] {
  const out: BedroomAgentOption[] = [];
  for (const row of raw.items) {
    if (row.type !== "agent") continue;
    const id = positiveInt(row.id);
    if (id == null) continue;
    out.push({ id, title: typeof row.title === "string" ? row.title.trim() : "" });
  }
  return out;
}

/** 初选 Anima：localStorage → 列表首项（禁止用默认聊天 agent 静默回退）。 */
function pickInitialAgentId(
  agents: BedroomAgentOption[],
  stored: number | undefined,
): number | null {
  if (stored != null && agents.some((a) => a.id === stored)) return stored;
  return agents[0]?.id ?? null;
}

export function BedroomAgentProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<BedroomAgentOption[]>([]);
  const [agentSubjectId, setAgentSubjectIdState] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const subjects = await listSubjectEntities({ limit: 500 });
        if (cancelled) return;
        const nextAgents = parseAgentSubjects(subjects);
        const initial = pickInitialAgentId(nextAgents, readStoredAgentSubjectId());
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
    (): BedroomAgentContextValue => ({
      agentSubjectId,
      setAgentSubjectId,
      agents,
      ready,
    }),
    [agentSubjectId, setAgentSubjectId, agents, ready],
  );

  return <BedroomAgentContext.Provider value={value}>{children}</BedroomAgentContext.Provider>;
}

export function useBedroomAgent(): BedroomAgentContextValue {
  const ctx = useContext(BedroomAgentContext);
  if (!ctx) {
    throw new Error("useBedroomAgent must be used within BedroomAgentProvider");
  }
  return ctx;
}

/** 当前卧室所选 Anima 的 subject id；未就绪时为 null。 */
export function useBedroomAgentSubjectId(): number | null {
  return useBedroomAgent().agentSubjectId;
}

function formatAgentLabel(id: number, title: string): string {
  const trimmed = title.trim();
  return trimmed || `#${id}`;
}

/** 卧室顶栏：选择这间卧室对应的 Anima。 */
export function BedroomAgentSelect({ className }: { className?: string }) {
  const { agentSubjectId, setAgentSubjectId, agents, ready } = useBedroomAgent();
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
