import { useCallback, useEffect, useState } from "react";
import { Checkbox, Input, Button } from "@freeanima/ui-kit";
import type { TaskItemRowPayload } from "@freeanima/shared/rpc-contract/frames/task.ts";
import { getCachedUserSubjectId } from "@freeanima/client/portal-sdk/world-context.ts";

import {
  completeTaskItem,
  createTaskItem,
  fetchSubtasks,
  uncompleteTaskItem,
  updateTaskItem,
} from "../lib/api.ts";

type Props = {
  parent: TaskItemRowPayload;
  onChanged?: () => void;
};

/** 详情内一层子任务 checklist */
export function TaskSubtaskSection({ parent, onChanged }: Props) {
  const [items, setItems] = useState<TaskItemRowPayload[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (parent.parent_id != null) {
      setItems([]);
      return;
    }
    try {
      const rows = await fetchSubtasks(parent.id);
      setItems(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [parent.id, parent.list_id, parent.parent_id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (parent.parent_id != null) return null;

  const add = async () => {
    const title = draft.trim();
    if (!title) return;
    if (parent.list_id == null && parent.project_id == null) return;
    setBusy(true);
    setError(null);
    try {
      if (parent.list_id != null) {
        await createTaskItem({
          title,
          list_id: parent.list_id,
          parent_id: parent.id,
        });
      } else {
        // 项目内子任务：直接 RPC（离线 create 目前只覆盖清单侧）
        const { getTypedHabitatClient } =
          await import("@freeanima/client/portal-sdk/habitat-typed-client.ts");
        const projectId = parent.project_id;
        if (typeof projectId !== "number") throw new Error("project_id is required");
        await getTypedHabitatClient().call("project.item.create", {
          subject_id: getCachedUserSubjectId(),
          title,
          project_id: projectId,
          parent_id: parent.id,
        });
      }
      setDraft("");
      await reload();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-2 border-t pt-3">
      <p className="text-muted-foreground text-xs font-medium">子任务</p>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2">
            <Checkbox
              isSelected={item.status === "completed"}
              aria-label={item.status === "completed" ? "标记未完成" : "标记完成"}
              onChange={(selected) => {
                void (async () => {
                  try {
                    if (selected) await completeTaskItem(item.id);
                    else await uncompleteTaskItem(item.id);
                    await reload();
                    onChanged?.();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : String(err));
                  }
                })();
              }}
            />
            <Input
              className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              value={item.title}
              aria-label="子任务标题"
              onChange={(e) => {
                const title = e.target.value;
                setItems((prev) => prev.map((r) => (r.id === item.id ? { ...r, title } : r)));
              }}
              onBlur={(e) => {
                const title = e.target.value.trim();
                if (!title || title === item.title) return;
                void updateTaskItem(item.id, { title }).then(() => onChanged?.());
              }}
            />
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <Input
          className="h-8"
          placeholder="添加子任务…"
          value={draft}
          disabled={busy || (parent.list_id == null && parent.project_id == null)}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void add();
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          isDisabled={busy}
          onClick={() => void add()}
        >
          添加
        </Button>
      </div>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
