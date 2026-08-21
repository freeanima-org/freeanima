import { omitUndefined } from "../../lib/omit-undefined.ts";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@freeanima/ui-kit";
import { FormField, FormFieldset } from "@freeanima/ui-kit/form/FormFieldset.tsx";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { formatDisplayDateTime } from "@freeanima/features/habitat/ui/habitat/lib/format-datetime.ts";
import {
  createWorldEntity,
  listSubjectEntities,
  listWorldEntities,
  updateWorldEntity,
  type EntityRow,
  type WorldGrantInput,
} from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { logCaughtError } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";

export const Route = createFileRoute("/_sidebar/worlds")({
  component: WorldsPage,
});

type GrantFormRow = {
  subject_id: string;
  permission: "read" | "write";
};

type WorldFormState = {
  title: string;
  summary: string;
  content: string;
  private: boolean;
  owner_subject_id: string;
  grants: GrantFormRow[];
  stable_key: string;
};

const EMPTY_FORM: WorldFormState = {
  title: "",
  summary: "",
  content: "",
  private: false,
  owner_subject_id: "",
  grants: [],
  stable_key: "",
};

function readWorldBody(row: EntityRow): {
  private: boolean;
  owner_subject_id: number | null;
  default_private: boolean;
  grants: WorldGrantInput[];
  stable_key: string;
} {
  const body = row.body ?? {};
  const isPrivate = body.private === true;
  const ownerSubjectId =
    typeof body.owner_subject_id === "number" && body.owner_subject_id > 0
      ? body.owner_subject_id
      : null;
  const grantsRaw = Array.isArray(body.grants) ? body.grants : [];
  const grants: WorldGrantInput[] = [];
  for (const g of grantsRaw) {
    if (!g || typeof g !== "object") continue;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- RPC/加载器响应边界
    const subjectId = Number((g as { subject_id?: unknown }).subject_id);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- RPC/加载器响应边界
    const permission = (g as { permission?: unknown }).permission;
    if (!Number.isFinite(subjectId) || subjectId <= 0) continue;
    if (permission !== "read" && permission !== "write") continue;
    if (ownerSubjectId != null && subjectId === ownerSubjectId) continue;
    grants.push({ subject_id: subjectId, permission });
  }
  const stableKey = typeof body.stable_key === "string" ? body.stable_key.trim() : "";
  return {
    private: isPrivate,
    owner_subject_id: ownerSubjectId,
    default_private: body.default_private === true,
    grants,
    stable_key: stableKey,
  };
}

function subjectOptionLabel(row: EntityRow): string {
  const typeLabel = row.type === "user" ? "用户" : "Agent";
  const title = row.title || "（无标题）";
  return `#${row.id} — ${title} (${typeLabel})`;
}

function WorldEditModal({
  mode,
  initial,
  subjects,
  saving,
  error,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  initial: WorldFormState;
  subjects: EntityRow[];
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (form: WorldFormState) => void;
}) {
  const [form, setForm] = useState(initial);

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ownerId = form.private && form.owner_subject_id ? Number(form.owner_subject_id) : null;

  const grantableSubjects = useMemo(
    () => subjects.filter((s) => ownerId == null || s.id !== ownerId),
    [subjects, ownerId],
  );

  const usedGrantSubjectIds = useMemo(
    () => new Set(form.grants.map((g) => g.subject_id).filter(Boolean)),
    [form.grants],
  );

  const addGrant = () => {
    const next = grantableSubjects.find((s) => !usedGrantSubjectIds.has(String(s.id)));
    if (!next) return;
    setForm((f) => ({
      ...f,
      grants: [...f.grants, { subject_id: String(next.id), permission: "read" }],
    }));
  };

  return (
    <Dialog
      isOpen
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      className="max-w-xl max-h-[90vh] overflow-y-auto safe-area-pt safe-area-pb"
    >
      <DialogHeader>
        <DialogTitle>{mode === "create" ? "新建世界" : "编辑世界"}</DialogTitle>
      </DialogHeader>
      {error ? (
        <StatusAlert variant="error" className="mb-3">
          {error}
        </StatusAlert>
      ) : null}
      <FormFieldset bordered={false} className="gap-3">
        <FormField label={"标题"} className="text-xs">
          <Input
            type="text"
            className="w-full h-8"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </FormField>
        <FormField label={"摘要"} className="text-xs">
          <Input
            type="text"
            className="w-full h-8"
            value={form.summary}
            onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
          />
        </FormField>
        <FormField label={"内容"} className="text-xs">
          <Textarea
            className="w-full min-h-24"
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
          />
        </FormField>
        <FormField label={"稳定键"} className="text-xs">
          <Input
            type="text"
            className="w-full h-8 font-mono text-xs"
            placeholder="git:github.com/org/repo"
            value={form.stable_key}
            onChange={(e) => setForm((f) => ({ ...f, stable_key: e.target.value }))}
          />
        </FormField>
        <FormField label={"可见性"} className="text-xs">
          <div className="flex items-center gap-2">
            <Checkbox
              id="world-private"
              isSelected={form.private}
              onChange={(checked) =>
                setForm((f) => {
                  const nextPrivate = checked;
                  const nextOwner = nextPrivate ? f.owner_subject_id : "";
                  const ownerNum = nextOwner ? Number(nextOwner) : null;
                  return {
                    ...f,
                    private: nextPrivate,
                    owner_subject_id: nextOwner,
                    grants: f.grants.filter(
                      (g) => ownerNum == null || Number(g.subject_id) !== ownerNum,
                    ),
                  };
                })
              }
            />
            <Label htmlFor="world-private">{"私有"}</Label>
          </div>
        </FormField>
        {form.private ? (
          <FormField label={"归属主体"} className="text-xs">
            <Select
              selectedKey={form.owner_subject_id || "__none__"}
              onSelectionChange={(key) => {
                if (key == null) return;
                const v = String(key);
                setForm((f) => {
                  const nextOwner = v === "__none__" ? "" : v;
                  const ownerNum = nextOwner ? Number(nextOwner) : null;
                  return {
                    ...f,
                    owner_subject_id: nextOwner,
                    grants: f.grants.filter(
                      (g) => ownerNum == null || Number(g.subject_id) !== ownerNum,
                    ),
                  };
                });
              }}
            >
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder={"选择主体…"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem id="__none__">{"选择主体…"}</SelectItem>
                {subjects.map((s) => (
                  <SelectItem key={s.id} id={String(s.id)}>
                    {subjectOptionLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        ) : null}

        <FormField label={"主体授权"} className="text-xs">
          <p className="text-muted-foreground mb-2 leading-snug">
            {
              "所有者始终拥有完全访问权。写权限包含读权限。公共世界对所有主体可读；此处授权主要用于开放写权限，或私有世界的读/写权限。"
            }
          </p>
          <div className="flex flex-col gap-2">
            {form.grants.map((grant, index) => {
              const taken = new Set(
                form.grants.map((g, i) => (i === index ? "" : g.subject_id)).filter(Boolean),
              );
              const options = grantableSubjects.filter(
                (s) => !taken.has(String(s.id)) || String(s.id) === grant.subject_id,
              );
              return (
                <div key={index} className="flex flex-wrap items-center gap-2">
                  <Select
                    selectedKey={grant.subject_id || "__none__"}
                    onSelectionChange={(key) => {
                      if (key == null) return;
                      const v = String(key);
                      setForm((f) => ({
                        ...f,
                        grants: f.grants.map((g, i) =>
                          i === index ? { ...g, subject_id: v === "__none__" ? "" : v } : g,
                        ),
                      }));
                    }}
                  >
                    <SelectTrigger size="sm" className="min-w-[12rem] flex-1">
                      <SelectValue placeholder={"主题"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem id="__none__">{"选择主体…"}</SelectItem>
                      {options.map((s) => (
                        <SelectItem key={s.id} id={String(s.id)}>
                          {subjectOptionLabel(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    selectedKey={grant.permission}
                    onSelectionChange={(key) => {
                      if (key == null) return;
                      const v = String(key);
                      setForm((f) => ({
                        ...f,
                        grants: f.grants.map((g, i) =>
                          i === index ? { ...g, permission: v === "write" ? "write" : "read" } : g,
                        ),
                      }));
                    }}
                  >
                    <SelectTrigger size="sm" className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem id="read">{"读"}</SelectItem>
                      <SelectItem id="write">{"写"}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        grants: f.grants.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    {"移除"}
                  </Button>
                </div>
              );
            })}
            {grantableSubjects.length === 0 ? (
              <p className="text-muted-foreground">{"没有可授权的其他主体。"}</p>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                isDisabled={
                  grantableSubjects.every((s) => usedGrantSubjectIds.has(String(s.id))) ||
                  form.grants.some((g) => !g.subject_id)
                }
                onClick={addGrant}
              >
                {"添加授权"}
              </Button>
            )}
          </div>
        </FormField>
      </FormFieldset>
      <DialogFooter>
        <Button type="button" variant="ghost" size="sm" isDisabled={saving} onClick={onClose}>
          {"取消"}
        </Button>
        <Button
          type="button"
          size="sm"
          isDisabled={
            saving ||
            !form.title.trim() ||
            (form.private && !form.owner_subject_id.trim()) ||
            form.grants.some((g) => !g.subject_id)
          }
          onClick={() => onSave(form)}
        >
          {saving ? <Spinner /> : "保存"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function WorldsPage() {
  const [items, setItems] = useState<EntityRow[]>([]);
  const [subjects, setSubjects] = useState<EntityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<{
    mode: "create" | "edit";
    row?: EntityRow;
  } | null>(null);
  const [modalError, setModalError] = useState("");
  const [saving, setSaving] = useState(false);

  const subjectTitleById = useCallback(
    (id: number | null): string => {
      if (id == null) return "（空）";
      const subject = subjects.find((s) => s.id === id);
      return subject?.title || `#${id}`;
    },
    [subjects],
  );

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [worldData, subjectData] = await Promise.all([
        listWorldEntities(),
        listSubjectEntities(),
      ]);
      setItems(worldData.items);
      setTotal(worldData.total);
      setSubjects(subjectData.items);
    } catch (e) {
      logCaughtError("routes/_sidebar/worlds", e);
      setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const openCreate = () => {
    setModalError("");
    setModal({ mode: "create" });
  };

  const openEdit = (row: EntityRow) => {
    setModalError("");
    setModal({ mode: "edit", row });
  };

  const closeModal = () => {
    if (!saving) setModal(null);
  };

  const modalInitial: WorldFormState =
    modal?.mode === "edit" && modal.row
      ? (() => {
          const access = readWorldBody(modal.row);
          return {
            title: modal.row.title,
            summary: modal.row.summary,
            content: modal.row.content,
            private: access.private,
            owner_subject_id:
              access.owner_subject_id != null ? String(access.owner_subject_id) : "",
            grants: access.grants.map((g) => ({
              subject_id: String(g.subject_id),
              permission: g.permission,
            })),
            stable_key: access.stable_key,
          };
        })()
      : EMPTY_FORM;

  const onSave = async (form: WorldFormState) => {
    setSaving(true);
    setModalError("");
    try {
      const ownerSubjectId = form.private ? Number(form.owner_subject_id) : undefined;
      const grants: WorldGrantInput[] = form.grants
        .map((g) => ({
          subject_id: Number(g.subject_id),
          permission: g.permission,
        }))
        .filter(
          (g) =>
            Number.isFinite(g.subject_id) &&
            g.subject_id > 0 &&
            (ownerSubjectId == null || g.subject_id !== ownerSubjectId),
        );
      const stableKey = form.stable_key.trim();
      const payload = omitUndefined({
        title: form.title.trim(),
        summary: form.summary.trim(),
        content: form.content.trim(),
        private: form.private,
        owner_subject_id: ownerSubjectId,
        grants,
        stable_key: stableKey || undefined,
      });
      if (modal?.mode === "edit" && modal.row) {
        await updateWorldEntity(modal.row.id, payload);
      } else {
        await createWorldEntity(payload);
      }
      setModal(null);
      await fetchList();
    } catch (e) {
      logCaughtError("routes/_sidebar/worlds/save", e);
      setModalError(`操作失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold">{"🌍 世界"}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {"逻辑命名空间（type=world）。可见性、归属主体与主体授权存放在 world_config body 中。"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 console-page-toolbar">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            isDisabled={loading}
            onClick={() => void fetchList()}
          >
            {"刷新"}
          </Button>
          <Button type="button" size="sm" onClick={openCreate}>
            {"新建世界"}
          </Button>
        </div>
      </div>

      {error ? (
        <StatusAlert variant="error" className="mb-4">
          {error}
        </StatusAlert>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <StatusAlert variant="info">{"暂无世界。创建后即可开始。"}</StatusAlert>
      ) : (
        <Card className="bg-muted py-0">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{"ID"}</TableHead>
                  <TableHead>{"标题"}</TableHead>
                  <TableHead>{"摘要"}</TableHead>
                  <TableHead>{"可见性"}</TableHead>
                  <TableHead>{"归属主体"}</TableHead>
                  <TableHead>{"主体授权"}</TableHead>
                  <TableHead>{"时间"}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => {
                  const access = readWorldBody(row);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.id}</TableCell>
                      <TableCell className="max-w-[12rem] truncate">
                        {row.title || "（无标题）"}
                      </TableCell>
                      <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                        {row.summary || "（空）"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {access.private ? (access.default_private ? "默认私有" : "私有") : "公开"}
                      </TableCell>
                      <TableCell className="text-xs max-w-[12rem] truncate">
                        {access.private ? subjectTitleById(access.owner_subject_id) : "（空）"}
                      </TableCell>
                      <TableCell className="text-xs max-w-[14rem] truncate text-muted-foreground">
                        {access.grants.length === 0
                          ? "（空）"
                          : access.grants
                              .map(
                                (g) =>
                                  `${subjectTitleById(g.subject_id)}:${g.permission === "write" ? "写" : "读"}`,
                              )
                              .join(", ")}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDisplayDateTime(row.updated_at)}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => openEdit(row)}
                        >
                          {"编辑"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="px-4 py-2 text-xs text-muted-foreground border-t border/50">
              {total} {"世界"}
            </div>
          </CardContent>
        </Card>
      )}

      {modal ? (
        <WorldEditModal
          mode={modal.mode}
          initial={modalInitial}
          subjects={subjects}
          saving={saving}
          error={modalError}
          onClose={closeModal}
          onSave={(form) => void onSave(form)}
        />
      ) : null}
    </div>
  );
}
