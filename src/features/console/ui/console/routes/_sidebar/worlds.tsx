import { omitUndefined } from "../../lib/omit-undefined.ts";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
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
} from "@freeanima/frontend/ui-kit";
import { FormField, FormFieldset } from "@freeanima/frontend/ui-kit/form/FormFieldset.tsx";
import { StatusAlert } from "@freeanima/frontend/ui-kit/composite";
import { formatDisplayDateTime } from "@freeanima/features/console/ui/console/lib/format-datetime.ts";
import { m } from "@freeanima/features/console/ui/console/lib/i18n.ts";
import {
  createWorldEntity,
  listSubjectEntities,
  listWorldEntities,
  updateWorldEntity,
  type EntityRow,
} from "@freeanima/features/console/ui/console/lib/api.ts";
import { logCaughtError } from "@freeanima/features/console/ui/console/lib/log-caught-error.ts";

export const Route = createFileRoute("/_sidebar/worlds")({
  component: WorldsPage,
});

type WorldFormState = {
  title: string;
  summary: string;
  content: string;
  private: boolean;
  owner_subject_id: string;
};

const EMPTY_FORM: WorldFormState = {
  title: "",
  summary: "",
  content: "",
  private: false,
  owner_subject_id: "",
};

function readWorldBody(row: EntityRow): {
  private: boolean;
  owner_subject_id: number | null;
  default_private: boolean;
} {
  const body = row.body ?? {};
  const isPrivate = body.private === true;
  const ownerSubjectId =
    typeof body.owner_subject_id === "number" && body.owner_subject_id > 0
      ? body.owner_subject_id
      : null;
  return {
    private: isPrivate,
    owner_subject_id: ownerSubjectId,
    default_private: body.default_private === true,
  };
}

function subjectOptionLabel(row: EntityRow): string {
  const typeLabel =
    row.type === "user" ? m.console_entities_type_user() : m.console_entities_type_agent();
  const title = row.title || m.console_common_no_title();
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

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-lg safe-area-pt safe-area-pb">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? m.console_entities_new_world() : m.console_entities_edit_world()}
          </DialogTitle>
        </DialogHeader>
        {error ? (
          <StatusAlert variant="error" className="mb-3">
            {error}
          </StatusAlert>
        ) : null}
        <FormFieldset bordered={false} className="gap-3">
          <FormField label={m.console_entities_col_title()} className="text-xs">
            <Input
              type="text"
              className="w-full h-8"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </FormField>
          <FormField label={m.console_entities_col_summary()} className="text-xs">
            <Input
              type="text"
              className="w-full h-8"
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
            />
          </FormField>
          <FormField label={m.console_entities_col_content()} className="text-xs">
            <Textarea
              className="w-full min-h-24"
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            />
          </FormField>
          <FormField label={m.console_entities_col_visibility()} className="text-xs">
            <div className="flex items-center gap-2">
              <Checkbox
                id="world-private"
                checked={form.private}
                onCheckedChange={(checked) =>
                  setForm((f) => ({
                    ...f,
                    private: checked === true,
                    owner_subject_id: checked === true ? f.owner_subject_id : "",
                  }))
                }
              />
              <Label htmlFor="world-private">{m.console_entities_visibility_private()}</Label>
            </div>
          </FormField>
          {form.private ? (
            <FormField label={m.console_entities_col_owner_subject()} className="text-xs">
              <Select
                value={form.owner_subject_id || "__none__"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, owner_subject_id: v === "__none__" ? "" : v }))
                }
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue placeholder={m.console_entities_owner_subject_placeholder()} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    {m.console_entities_owner_subject_placeholder()}
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
        </FormFieldset>
        <DialogFooter>
          <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={onClose}>
            {m.console_common_cancel()}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={
              saving || !form.title.trim() || (form.private && !form.owner_subject_id.trim())
            }
            onClick={() => onSave(form)}
          >
            {saving ? <Spinner /> : m.console_common_save()}
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
      if (id == null) return m.console_common_empty();
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
        m.console_common_load_failed({
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
          };
        })()
      : EMPTY_FORM;

  const onSave = async (form: WorldFormState) => {
    setSaving(true);
    setModalError("");
    try {
      const ownerSubjectId = form.private ? Number(form.owner_subject_id) : undefined;
      const payload = omitUndefined({
        title: form.title.trim(),
        summary: form.summary.trim(),
        content: form.content.trim(),
        private: form.private,
        owner_subject_id: ownerSubjectId,
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
        m.console_common_operation_failed({
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
          <h2 className="text-lg font-bold">{m.console_nav_worlds()}</h2>
          <p className="text-sm text-muted-foreground mt-1">{m.console_entities_worlds_desc()}</p>
        </div>
        <div className="flex flex-wrap gap-2 console-page-toolbar">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={loading}
            onClick={() => void fetchList()}
          >
            {m.console_common_refresh()}
          </Button>
          <Button type="button" size="sm" onClick={openCreate}>
            {m.console_entities_new_world()}
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
        <StatusAlert variant="info">{m.console_entities_worlds_empty()}</StatusAlert>
      ) : (
        <Card className="bg-muted py-0">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{m.console_entities_col_id()}</TableHead>
                  <TableHead>{m.console_entities_col_title()}</TableHead>
                  <TableHead>{m.console_entities_col_summary()}</TableHead>
                  <TableHead>{m.console_entities_col_visibility()}</TableHead>
                  <TableHead>{m.console_entities_col_owner_subject()}</TableHead>
                  <TableHead>{m.console_common_time()}</TableHead>
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
                        {row.title || m.console_common_no_title()}
                      </TableCell>
                      <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                        {row.summary || m.console_common_empty()}
                      </TableCell>
                      <TableCell className="text-xs">
                        {access.private
                          ? access.default_private
                            ? m.console_entities_world_default_private_badge()
                            : m.console_entities_visibility_private()
                          : m.console_entities_visibility_public()}
                      </TableCell>
                      <TableCell className="text-xs max-w-[12rem] truncate">
                        {access.private
                          ? subjectTitleById(access.owner_subject_id)
                          : m.console_common_empty()}
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
                          {m.console_common_edit()}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="px-4 py-2 text-xs text-muted-foreground border-t border/50">
              {total} {m.console_entities_worlds_count_label()}
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
