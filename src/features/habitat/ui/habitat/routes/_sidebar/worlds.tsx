import { omitUndefined } from "../../lib/omit-undefined.ts";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogContent,
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
import { m } from "@freeanima/features/habitat/ui/habitat/lib/i18n.ts";
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
};

const EMPTY_FORM: WorldFormState = {
  title: "",
  summary: "",
  content: "",
  private: false,
  owner_subject_id: "",
  grants: [],
};

function readWorldBody(row: EntityRow): {
  private: boolean;
  owner_subject_id: number | null;
  default_private: boolean;
  grants: WorldGrantInput[];
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
    const subjectId = Number((g as { subject_id?: unknown }).subject_id);
    const permission = (g as { permission?: unknown }).permission;
    if (!Number.isFinite(subjectId) || subjectId <= 0) continue;
    if (permission !== "read" && permission !== "write") continue;
    if (ownerSubjectId != null && subjectId === ownerSubjectId) continue;
    grants.push({ subject_id: subjectId, permission });
  }
  return {
    private: isPrivate,
    owner_subject_id: ownerSubjectId,
    default_private: body.default_private === true,
    grants,
  };
}

function subjectOptionLabel(row: EntityRow): string {
  const typeLabel =
    row.type === "user" ? m.habitat_entities_type_user() : m.habitat_entities_type_agent();
  const title = row.title || m.habitat_common_no_title();
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
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto safe-area-pt safe-area-pb">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? m.habitat_entities_new_world() : m.habitat_entities_edit_world()}
          </DialogTitle>
        </DialogHeader>
        {error ? (
          <StatusAlert variant="error" className="mb-3">
            {error}
          </StatusAlert>
        ) : null}
        <FormFieldset bordered={false} className="gap-3">
          <FormField label={m.habitat_entities_col_title()} className="text-xs">
            <Input
              type="text"
              className="w-full h-8"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </FormField>
          <FormField label={m.habitat_entities_col_summary()} className="text-xs">
            <Input
              type="text"
              className="w-full h-8"
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
            />
          </FormField>
          <FormField label={m.habitat_entities_col_content()} className="text-xs">
            <Textarea
              className="w-full min-h-24"
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            />
          </FormField>
          <FormField label={m.habitat_entities_col_visibility()} className="text-xs">
            <div className="flex items-center gap-2">
              <Checkbox
                id="world-private"
                checked={form.private}
                onCheckedChange={(checked) =>
                  setForm((f) => {
                    const nextPrivate = checked === true;
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
              <Label htmlFor="world-private">{m.habitat_entities_visibility_private()}</Label>
            </div>
          </FormField>
          {form.private ? (
            <FormField label={m.habitat_entities_col_owner_subject()} className="text-xs">
              <Select
                value={form.owner_subject_id || "__none__"}
                onValueChange={(v) =>
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
                  })
                }
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue placeholder={m.habitat_entities_owner_subject_placeholder()} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    {m.habitat_entities_owner_subject_placeholder()}
                  </SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {subjectOptionLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          ) : null}

          <FormField label={m.habitat_entities_grants_label()} className="text-xs">
            <p className="text-muted-foreground mb-2 leading-snug">
              {m.habitat_entities_grants_hint()}
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
                      value={grant.subject_id || "__none__"}
                      onValueChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          grants: f.grants.map((g, i) =>
                            i === index ? { ...g, subject_id: v === "__none__" ? "" : v } : g,
                          ),
                        }))
                      }
                    >
                      <SelectTrigger size="sm" className="min-w-[12rem] flex-1">
                        <SelectValue placeholder={m.habitat_entities_grant_subject_label()} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          {m.habitat_entities_owner_subject_placeholder()}
                        </SelectItem>
                        {options.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {subjectOptionLabel(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={grant.permission}
                      onValueChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          grants: f.grants.map((g, i) =>
                            i === index
                              ? { ...g, permission: v === "write" ? "write" : "read" }
                              : g,
                          ),
                        }))
                      }
                    >
                      <SelectTrigger size="sm" className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="read">
                          {m.habitat_entities_grant_permission_read()}
                        </SelectItem>
                        <SelectItem value="write">
                          {m.habitat_entities_grant_permission_write()}
                        </SelectItem>
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
                      {m.habitat_entities_grant_remove()}
                    </Button>
                  </div>
                );
              })}
              {grantableSubjects.length === 0 ? (
                <p className="text-muted-foreground">
                  {m.habitat_entities_grants_empty_subjects()}
                </p>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  disabled={
                    grantableSubjects.every((s) => usedGrantSubjectIds.has(String(s.id))) ||
                    form.grants.some((g) => !g.subject_id)
                  }
                  onClick={addGrant}
                >
                  {m.habitat_entities_grant_add()}
                </Button>
              )}
            </div>
          </FormField>
        </FormFieldset>
        <DialogFooter>
          <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={onClose}>
            {m.habitat_common_cancel()}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={
              saving ||
              !form.title.trim() ||
              (form.private && !form.owner_subject_id.trim()) ||
              form.grants.some((g) => !g.subject_id)
            }
            onClick={() => onSave(form)}
          >
            {saving ? <Spinner /> : m.habitat_common_save()}
          </Button>
        </DialogFooter>
      </DialogContent>
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
      if (id == null) return m.habitat_common_empty();
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
      setError(
        m.habitat_common_load_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
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
      const payload = omitUndefined({
        title: form.title.trim(),
        summary: form.summary.trim(),
        content: form.content.trim(),
        private: form.private,
        owner_subject_id: ownerSubjectId,
        grants,
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
      setModalError(
        m.habitat_common_operation_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold">{m.habitat_nav_worlds()}</h2>
          <p className="text-sm text-muted-foreground mt-1">{m.habitat_entities_worlds_desc()}</p>
        </div>
        <div className="flex flex-wrap gap-2 console-page-toolbar">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={loading}
            onClick={() => void fetchList()}
          >
            {m.habitat_common_refresh()}
          </Button>
          <Button type="button" size="sm" onClick={openCreate}>
            {m.habitat_entities_new_world()}
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
        <StatusAlert variant="info">{m.habitat_entities_worlds_empty()}</StatusAlert>
      ) : (
        <Card className="bg-muted py-0">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{m.habitat_entities_col_id()}</TableHead>
                  <TableHead>{m.habitat_entities_col_title()}</TableHead>
                  <TableHead>{m.habitat_entities_col_summary()}</TableHead>
                  <TableHead>{m.habitat_entities_col_visibility()}</TableHead>
                  <TableHead>{m.habitat_entities_col_owner_subject()}</TableHead>
                  <TableHead>{m.habitat_entities_grants_label()}</TableHead>
                  <TableHead>{m.habitat_common_time()}</TableHead>
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
                        {row.title || m.habitat_common_no_title()}
                      </TableCell>
                      <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                        {row.summary || m.habitat_common_empty()}
                      </TableCell>
                      <TableCell className="text-xs">
                        {access.private
                          ? access.default_private
                            ? m.habitat_entities_world_default_private_badge()
                            : m.habitat_entities_visibility_private()
                          : m.habitat_entities_visibility_public()}
                      </TableCell>
                      <TableCell className="text-xs max-w-[12rem] truncate">
                        {access.private
                          ? subjectTitleById(access.owner_subject_id)
                          : m.habitat_common_empty()}
                      </TableCell>
                      <TableCell className="text-xs max-w-[14rem] truncate text-muted-foreground">
                        {access.grants.length === 0
                          ? m.habitat_common_empty()
                          : access.grants
                              .map(
                                (g) =>
                                  `${subjectTitleById(g.subject_id)}:${g.permission === "write" ? m.habitat_entities_grant_permission_write() : m.habitat_entities_grant_permission_read()}`,
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
                          {m.habitat_common_edit()}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="px-4 py-2 text-xs text-muted-foreground border-t border/50">
              {total} {m.habitat_entities_worlds_count_label()}
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
