import { useEffect, useState, type JSX } from "react";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { Button, Input } from "@freeanima/frontend/ui-kit";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@freeanima/frontend/ui-kit/components/ui/dialog.tsx";

import type { DiaryBlockTemplateRow } from "../lib/api.ts";
import {
  createDiaryBlockTemplate,
  deleteDiaryBlockTemplate,
  fetchDiaryBlockTemplates,
  updateDiaryBlockTemplate,
} from "../lib/api.ts";
import type { DiarySubjectKind } from "../lib/format-diary.ts";

type EditorState = {
  id?: number;
  name: string;
  presetTitle: string;
  presetContent: string;
};

const emptyEditor = (): EditorState => ({
  name: "",
  presetTitle: "",
  presetContent: "",
});

export function DiaryBlockTemplateDialog({
  open,
  subjectKind,
  onClose,
  onChanged,
}: {
  open: boolean;
  subjectKind: DiarySubjectKind;
  onClose: () => void;
  onChanged: (items: DiaryBlockTemplateRow[]) => void;
}): JSX.Element {
  const [items, setItems] = useState<DiaryBlockTemplateRow[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetchDiaryBlockTemplates(subjectKind)
      .then((rows) => {
        if (!cancelled) {
          setItems(rows);
          onChanged(rows);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [open, onChanged, subjectKind]);

  async function reload(): Promise<DiaryBlockTemplateRow[]> {
    const rows = await fetchDiaryBlockTemplates(subjectKind);
    setItems(rows);
    onChanged(rows);
    return rows;
  }

  async function handleSave(): Promise<void> {
    if (!editor) return;
    const name = editor.name.trim();
    if (!name) {
      setError("请填写模板名称");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const preset = {
        title: editor.presetTitle.trim(),
        content: editor.presetContent,
        components: ["content_block"],
        tag_ids: [] as number[],
      };
      if (editor.id != null) {
        await updateDiaryBlockTemplate(subjectKind, editor.id, {
          name,
          preset,
        });
      } else {
        await createDiaryBlockTemplate(subjectKind, { name, preset });
      }
      setEditor(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number): Promise<void> {
    setBusy(true);
    setError("");
    try {
      await deleteDiaryBlockTemplate(subjectKind, id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>日记块模板</DialogTitle>
        </DialogHeader>

        {editor ? (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground text-xs">模板名称</span>
              <Input
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                placeholder="如：今日回顾"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground text-xs">插入块标题（preset）</span>
              <Input
                value={editor.presetTitle}
                onChange={(e) => setEditor({ ...editor, presetTitle: e.target.value })}
                placeholder="可选"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground text-xs">插入块正文（preset）</span>
              <Input
                value={editor.presetContent}
                onChange={(e) => setEditor({ ...editor, presetContent: e.target.value })}
                placeholder="通常留空"
              />
            </label>
            <DialogFooter>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setEditor(null)}>
                取消
              </Button>
              <Button type="button" disabled={busy} onClick={() => void handleSave()}>
                保存
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setEditor(emptyEditor())}
              >
                <PlusIcon className="size-3.5" />
                新建模板
              </Button>
            </div>
            {items.length === 0 ? (
              <p className="text-muted-foreground text-sm">暂无模板</p>
            ) : (
              <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="border-border/60 flex items-center gap-2 rounded-md border px-2 py-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        块标题：{item.preset.title || "（空）"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      aria-label={`编辑 ${item.name}`}
                      disabled={busy}
                      onClick={() =>
                        setEditor({
                          id: item.id,
                          name: item.name,
                          presetTitle: item.preset.title,
                          presetContent: item.preset.content,
                        })
                      }
                    >
                      <PencilIcon className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive h-7 w-7 p-0"
                      aria-label={`删除 ${item.name}`}
                      disabled={busy}
                      onClick={() => void handleDelete(item.id)}
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                关闭
              </Button>
            </DialogFooter>
          </div>
        )}
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
