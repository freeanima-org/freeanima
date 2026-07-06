import { omitUndefined } from "../../lib/omit-undefined.ts";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
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
import { FormField, FormFieldset } from "@freeanima/ui-kit/form";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { formatDisplayDateTime } from "@console/lib/format-datetime.ts";
import { m } from "@console/lib/i18n.ts";
import {
  createSubjectEntity,
  listSubjectEntities,
  listWorldEntities,
  updateSubjectEntity,
  type EntityRow,
} from "@console/lib/api.ts";
import { logCaughtError } from "@console/lib/log-caught-error.ts";
import { SubjectApiTokensModal } from "./subject-api-tokens-modal.tsx";

export const Route = createFileRoute("/_sidebar/subjects")({
  component: SubjectsPage,
});

type SubjectFormState = {
  type: "agent" | "user";
  title: string;
  summary: string;
  content: string;
  default_private_world_id: string;
};

const EMPTY_FORM: SubjectFormState = {
  type: "agent",
  title: "",
  summary: "",
  content: "",
  default_private_world_id: "",
};

function readDefaultPrivateWorldId(row: EntityRow): number | null {
  const id = row.body?.default_private_world_id;
  return typeof id === "number" && id > 0 ? id : null;
}

function isPrivateWorldOwnedBySubject(world: EntityRow, subjectId: number): boolean {
  const body = world.body ?? {};
  const ownerId = Number(body.owner_subject_id);
  return body.private === true && Number.isInteger(ownerId) && ownerId === subjectId;
}

function resolveDefaultPrivateWorldId(row: EntityRow, candidateWorlds: EntityRow[]): string {
  const fromSubject = readDefaultPrivateWorldId(row);
  if (fromSubject != null && candidateWorlds.some((w) => w.id === fromSubject)) {
    return String(fromSubject);
  }
  const marked = candidateWorlds.find((w) => w.body?.default_private === true);
  if (marked) return String(marked.id);
  if (candidateWorlds.length > 0) {
    const first = candidateWorlds[0];
    if (first) return String(first.id);
  }
  return fromSubject != null ? String(fromSubject) : "";
}

function privateWorldsForSubject(worlds: EntityRow[], subjectId: number): EntityRow[] {
  return worlds.filter((w) => isPrivateWorldOwnedBySubject(w, subjectId));
}

function worldOptionLabel(row: EntityRow): string {
  const title = row.title || m.console_common_no_title();
  const suffix =
    row.body?.default_private === true
      ? ` (${m.console_entities_world_default_private_badge()})`
      : "";
  return `#${row.id} — ${title}${suffix}`;
}

function SubjectEditModal({
  mode,
  initial,
  candidateWorlds,
  saving,
  error,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  initial: SubjectFormState;
  candidateWorlds: EntityRow[];
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (form: SubjectFormState) => void;
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
            {mode === "create"
              ? m.console_entities_new_subject()
              : m.console_entities_edit_subject()}
          </DialogTitle>
        </DialogHeader>
        {error ? (
          <StatusAlert variant="error" className="mb-3">
            {error}
          </StatusAlert>
        ) : null}
        <FormFieldset bordered={false} className="gap-3">
          {mode === "create" ? (
            <FormField label={m.console_entities_col_type()} className="text-xs">
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    type: v === "user" ? "user" : "agent",
                  }))
                }
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">{m.console_entities_type_agent()}</SelectItem>
                  <SelectItem value="user">{m.console_entities_type_user()}</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          ) : null}
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
          {mode === "edit" ? (
            <FormField label={m.console_entities_col_default_private_world()} className="text-xs">
              {candidateWorlds.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  {m.console_entities_default_private_world_empty()}
                </p>
              ) : (
                <Select
                  value={form.default_private_world_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, default_private_world_id: v }))}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {candidateWorlds.map((w) => (
                      <SelectItem key={w.id} value={String(w.id)}>
                        {worldOptionLabel(w)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          ) : (
            <p className="text-xs text-muted-foreground">
              {m.console_entities_subject_create_hint()}
            </p>
          )}
        </FormFieldset>
        <DialogFooter>
          <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={onClose}>
            {m.console_common_cancel()}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving || !form.title.trim()}
            onClick={() => onSave(form)}
          >
            {saving ? <Spinner /> : m.console_common_save()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function subjectTypeLabel(type: string): string {
  if (type === "agent") return m.console_entities_type_agent();
  if (type === "user") return m.console_entities_type_user();
  return type;
}

function SubjectsPage() {
  const [items, setItems] = useState<EntityRow[]>([]);
  const [worlds, setWorlds] = useState<EntityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<{
    mode: "create" | "edit";
    row?: EntityRow;
  } | null>(null);
  const [tokensSubject, setTokensSubject] = useState<EntityRow | null>(null);
  const [modalError, setModalError] = useState("");
  const [saving, setSaving] = useState(false);

  const worldTitleById = useCallback(
    (id: number | null): string => {
      if (id == null) return m.console_common_empty();
      const world = worlds.find((w) => w.id === id);
      return world?.title || `#${id}`;
    },
    [worlds],
  );

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [subjectData, worldData] = await Promise.all([
        listSubjectEntities(),
        listWorldEntities(),
      ]);
      setItems(subjectData.items);
      setTotal(subjectData.total);
      setWorlds(worldData.items);
    } catch (e) {
      logCaughtError("routes/_sidebar/subjects", e);
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

  const modalCandidateWorlds = useMemo(() => {
    if (modal?.mode !== "edit" || !modal.row) return [];
    return privateWorldsForSubject(worlds, modal.row.id);
  }, [modal, worlds]);

  const modalInitial: SubjectFormState =
    modal?.mode === "edit" && modal.row
      ? {
          type: modal.row.type === "user" ? "user" : "agent",
          title: modal.row.title,
          summary: modal.row.summary,
          content: modal.row.content,
          default_private_world_id: resolveDefaultPrivateWorldId(modal.row, modalCandidateWorlds),
        }
      : EMPTY_FORM;

  const onSave = async (form: SubjectFormState) => {
    setSaving(true);
    setModalError("");
    try {
      if (modal?.mode === "edit" && modal.row) {
        const defaultWorldId = form.default_private_world_id.trim()
          ? Number(form.default_private_world_id)
          : undefined;
        await updateSubjectEntity(
          modal.row.id,
          omitUndefined({
            title: form.title.trim(),
            summary: form.summary.trim(),
            content: form.content.trim(),
            default_private_world_id:
              defaultWorldId != null && Number.isInteger(defaultWorldId) && defaultWorldId > 0
                ? defaultWorldId
                : undefined,
          }),
        );
      } else {
        await createSubjectEntity({
          type: form.type,
          title: form.title.trim(),
          summary: form.summary.trim(),
          content: form.content.trim(),
        });
      }
      setModal(null);
      await fetchList();
    } catch (e) {
      logCaughtError("routes/_sidebar/subjects/save", e);
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
          <h2 className="text-lg font-bold">{m.console_nav_subjects()}</h2>
          <p className="text-sm text-muted-foreground mt-1">{m.console_entities_subjects_desc()}</p>
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
            {m.console_entities_new_subject()}
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
        <StatusAlert variant="info">{m.console_entities_subjects_empty()}</StatusAlert>
      ) : (
        <Card className="bg-muted py-0">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{m.console_entities_col_id()}</TableHead>
                  <TableHead>{m.console_entities_col_type()}</TableHead>
                  <TableHead>{m.console_entities_col_title()}</TableHead>
                  <TableHead>{m.console_entities_col_default_private_world()}</TableHead>
                  <TableHead>{m.console_common_time()}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.id}</TableCell>
                    <TableCell>
                      <Badge variant="ghost" className="text-xs">
                        {subjectTypeLabel(row.type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[12rem] truncate">
                      {row.title || m.console_common_no_title()}
                    </TableCell>
                    <TableCell className="text-xs max-w-[12rem] truncate">
                      {worldTitleById(readDefaultPrivateWorldId(row))}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDisplayDateTime(row.updated_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => openEdit(row)}
                        >
                          {m.console_common_edit()}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setTokensSubject(row)}
                        >
                          {m.console_entities_api_tokens()}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="px-4 py-2 text-xs text-muted-foreground border-t border/50">
              {total} {m.console_entities_subjects_count_label()}
            </div>
          </CardContent>
        </Card>
      )}

      {modal ? (
        <SubjectEditModal
          mode={modal.mode}
          initial={modalInitial}
          candidateWorlds={modalCandidateWorlds}
          saving={saving}
          error={modalError}
          onClose={closeModal}
          onSave={(form) => void onSave(form)}
        />
      ) : null}

      {tokensSubject ? (
        <SubjectApiTokensModal subject={tokensSubject} onClose={() => setTokensSubject(null)} />
      ) : null}
    </div>
  );
}
