import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FormField, FormFieldset } from "@freeanima/ui-kit/form";
import { formatDisplayDateTime } from "@admin/lib/format-datetime.ts";
import { m } from "@admin/lib/i18n.ts";
import {
  createSubjectEntity,
  listSubjectEntities,
  listWorldEntities,
  updateSubjectEntity,
  type EntityRow,
} from "@admin/lib/api.ts";
import { logCaughtError } from "@admin/lib/log-caught-error.ts";

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
  if (candidateWorlds.length > 0) return String(candidateWorlds[0].id);
  return fromSubject != null ? String(fromSubject) : "";
}

function privateWorldsForSubject(worlds: EntityRow[], subjectId: number): EntityRow[] {
  return worlds.filter((w) => isPrivateWorldOwnedBySubject(w, subjectId));
}

function worldOptionLabel(row: EntityRow): string {
  const title = row.title || m.admin_common_no_title();
  const suffix =
    row.body?.default_private === true
      ? ` (${m.admin_entities_world_default_private_badge()})`
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
    <dialog className="modal modal-open safe-area-pt safe-area-pb">
      <div className="modal-box max-w-lg">
        <h3 className="font-bold text-lg mb-4">
          {mode === "create" ? m.admin_entities_new_subject() : m.admin_entities_edit_subject()}
        </h3>
        {error ? <div className="alert alert-error text-sm mb-3">{error}</div> : null}
        <FormFieldset bordered={false} className="gap-3">
          {mode === "create" ? (
            <FormField label={m.admin_entities_col_type()} className="text-xs">
              <select
                className="select select-bordered select-sm w-full"
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    type: e.target.value === "user" ? "user" : "agent",
                  }))
                }
              >
                <option value="agent">{m.admin_entities_type_agent()}</option>
                <option value="user">{m.admin_entities_type_user()}</option>
              </select>
            </FormField>
          ) : null}
          <FormField label={m.admin_entities_col_title()} className="text-xs">
            <input
              type="text"
              className="input input-bordered input-sm w-full"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </FormField>
          <FormField label={m.admin_entities_col_summary()} className="text-xs">
            <input
              type="text"
              className="input input-bordered input-sm w-full"
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
            />
          </FormField>
          <FormField label={m.admin_entities_col_content()} className="text-xs">
            <textarea
              className="textarea textarea-bordered textarea-sm w-full min-h-24"
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            />
          </FormField>
          {mode === "edit" ? (
            <FormField label={m.admin_entities_col_default_private_world()} className="text-xs">
              {candidateWorlds.length === 0 ? (
                <p className="text-sm text-base-content/60 py-2">
                  {m.admin_entities_default_private_world_empty()}
                </p>
              ) : (
                <select
                  className="select select-bordered select-sm w-full"
                  value={form.default_private_world_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, default_private_world_id: e.target.value }))
                  }
                >
                  {candidateWorlds.map((w) => (
                    <option key={w.id} value={String(w.id)}>
                      {worldOptionLabel(w)}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
          ) : (
            <p className="text-xs text-base-content/60">{m.admin_entities_subject_create_hint()}</p>
          )}
        </FormFieldset>
        <div className="modal-action">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={saving}
            onClick={onClose}
          >
            {m.admin_common_cancel()}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={saving || !form.title.trim()}
            onClick={() => onSave(form)}
          >
            {saving ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              m.admin_common_save()
            )}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose}>
          close
        </button>
      </form>
    </dialog>
  );
}

function subjectTypeLabel(type: string): string {
  if (type === "agent") return m.admin_entities_type_agent();
  if (type === "user") return m.admin_entities_type_user();
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
  const [modalError, setModalError] = useState("");
  const [saving, setSaving] = useState(false);

  const worldTitleById = useCallback(
    (id: number | null): string => {
      if (id == null) return m.admin_common_empty();
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
        m.admin_common_load_failed({
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
        await updateSubjectEntity(modal.row.id, {
          title: form.title.trim(),
          summary: form.summary.trim(),
          content: form.content.trim(),
          default_private_world_id:
            defaultWorldId != null && Number.isInteger(defaultWorldId) && defaultWorldId > 0
              ? defaultWorldId
              : undefined,
        });
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
        m.admin_common_operation_failed({
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
          <h2 className="text-lg font-bold">{m.admin_nav_subjects()}</h2>
          <p className="text-sm text-base-content/60 mt-1">{m.admin_entities_subjects_desc()}</p>
        </div>
        <div className="flex flex-wrap gap-2 admin-page-toolbar">
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={loading}
            onClick={() => void fetchList()}
          >
            {m.admin_common_refresh()}
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={openCreate}>
            {m.admin_entities_new_subject()}
          </button>
        </div>
      </div>

      {error ? <div className="alert alert-error text-sm mb-4">{error}</div> : null}

      {loading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-dots loading-md" />
        </div>
      ) : items.length === 0 ? (
        <div className="alert alert-info text-sm">{m.admin_entities_subjects_empty()}</div>
      ) : (
        <div className="card bg-base-200">
          <div className="card-body p-0 overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>{m.admin_entities_col_id()}</th>
                  <th>{m.admin_entities_col_type()}</th>
                  <th>{m.admin_entities_col_title()}</th>
                  <th>{m.admin_entities_col_default_private_world()}</th>
                  <th>{m.admin_common_time()}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td className="font-mono text-xs">{row.id}</td>
                    <td>
                      <span className="badge badge-ghost badge-sm">
                        {subjectTypeLabel(row.type)}
                      </span>
                    </td>
                    <td className="max-w-[12rem] truncate">
                      {row.title || m.admin_common_no_title()}
                    </td>
                    <td className="text-xs max-w-[12rem] truncate">
                      {worldTitleById(readDefaultPrivateWorldId(row))}
                    </td>
                    <td className="text-xs text-base-content/60">
                      {formatDisplayDateTime(row.updated_at)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost"
                        onClick={() => openEdit(row)}
                      >
                        {m.admin_common_edit()}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 text-xs text-base-content/60 border-t border-base-300/50">
              {total} {m.admin_entities_subjects_count_label()}
            </div>
          </div>
        </div>
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
    </div>
  );
}
