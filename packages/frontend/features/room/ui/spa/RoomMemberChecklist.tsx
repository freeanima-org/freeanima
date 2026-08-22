import { useEffect, useState } from "react";
import { CheckIcon } from "lucide-react";
import { Spinner, cn } from "@freeanima/ui-kit";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";
import { asRecord } from "@freeanima/shared/util";

export type RoomMemberCandidate = {
  id: number;
  title: string;
  kind: "agent" | "user";
  public_id?: string;
};

type RoomMemberChecklistProps = {
  value: number[];
  onChange: (ids: number[]) => void;
  /** 已在群内的 public_id，勾选禁用并标注 */
  alreadyInPublicIds?: string[];
  disabled?: boolean;
  /** 为 true 时拉取列表（弹层打开时） */
  active: boolean;
};

function parseSubjects(raw: unknown): RoomMemberCandidate[] {
  const rec = asRecord(raw);
  const items = rec?.items;
  if (!Array.isArray(items)) return [];
  const out: RoomMemberCandidate[] = [];
  for (const row of items) {
    const r = asRecord(row);
    if (!r) continue;
    const kind = r.type === "agent" || r.type === "user" ? r.type : null;
    if (!kind) continue;
    const id = typeof r.id === "number" ? r.id : Number(r.id);
    if (!Number.isInteger(id) || id <= 0) continue;
    const title = typeof r.title === "string" ? r.title.trim() : "";
    const body = asRecord(r.body);
    const public_id =
      typeof body?.public_id === "string" && body.public_id.trim()
        ? body.public_id.trim()
        : undefined;
    out.push({
      id,
      title: title || (kind === "agent" ? `Anima #${id}` : `用户 #${id}`),
      kind,
      ...(public_id ? { public_id } : {}),
    });
  }
  out.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "agent" ? -1 : 1;
    return a.title.localeCompare(b.title, "zh");
  });
  return out;
}

async function loadAllSubjects(): Promise<RoomMemberCandidate[]> {
  const raw = await getTypedHabitatClient().call("entity.subjectsList", { limit: 500 });
  return parseSubjects(raw);
}

/** 群聊选人：打开即列出全部本机用户 / Anima，无需搜索。 */
export function RoomMemberChecklist({
  value,
  onChange,
  alreadyInPublicIds,
  disabled = false,
  active,
}: RoomMemberChecklistProps) {
  const [items, setItems] = useState<RoomMemberCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alreadyPublic = new Set(alreadyInPublicIds ?? []);

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const next = await loadAllSubjects();
        if (!cancelled) setItems(next);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  function isAlreadyIn(row: RoomMemberCandidate): boolean {
    return row.public_id != null && alreadyPublic.has(row.public_id);
  }

  function toggle(row: RoomMemberCandidate) {
    if (disabled || isAlreadyIn(row)) return;
    if (value.includes(row.id)) onChange(value.filter((x) => x !== row.id));
    else onChange([...value, row.id]);
  }

  if (!active) return null;

  return (
    <div className="space-y-2">
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      <ul
        className="border-input bg-background h-[min(50vh,18rem)] overflow-y-auto rounded-md border p-1"
        role="listbox"
        aria-multiselectable
        aria-label="可选成员"
      >
        {loading ? (
          <li className="flex justify-center py-8">
            <Spinner />
          </li>
        ) : items.length === 0 ? (
          <li className="text-muted-foreground px-3 py-4 text-sm">暂无可选用户或 Anima</li>
        ) : (
          items.map((row) => {
            const selected = value.includes(row.id);
            const inRoom = isAlreadyIn(row);
            return (
              <li key={row.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected || inRoom}
                  disabled={disabled || inRoom}
                  className={cn(
                    "flex w-full min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm",
                    inRoom
                      ? "text-muted-foreground cursor-not-allowed opacity-60"
                      : "hover:bg-muted",
                    selected && !inRoom && "bg-accent",
                  )}
                  onClick={() => toggle(row)}
                >
                  <span className="size-4 shrink-0">
                    {selected || inRoom ? <CheckIcon className="size-4" /> : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{row.title}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {inRoom ? "已在群内" : row.kind === "agent" ? "Anima" : "用户"}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
