import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { FormField, FormFieldset } from "@freeanima/satellite-sdk/form";
import { formatDisplayDateTime } from "@admin/lib/format-datetime.ts";
import { m } from "@admin/lib/i18n.ts";
import {
  createWorldEntity,
  listSubjectEntities,
  listWorldEntities,
  updateWorldEntity,
  type EntityRow,
} from "@admin/lib/api.ts";
import { logCaughtError } from "@admin/lib/log-caught-error.ts";

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
    row.type === "user" ? m.admin_entities_type_user() : m.admin_entities_type_agent();
  const title = row.title || m.admin_common_no_title();
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
    <dialog className="modal modal-open safe-area-pt safe-area-pb">
      <div className="modal-box max-w-lg">
        <h3 className="font-bold text-lg mb-4">
          {mode === "create" ? m.admin_entities_new_world() : m.admin_entities_edit_world()}
        </h3>
        {error ? <div className="alert alert-error text-sm mb-3">{error}</div> : null}
        <FormFieldset bordered={false} className="gap-3">
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
          <FormField label={m.admin_entities_col_visibility()} className="text-xs">
            <label className="label cursor-pointer justify-start gap-2 py-0">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={form.private}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    private: e.target.checked,
                    owner_subject_id: e.target.checked ? f.owner_subject_id : "",
                  }))
                }
              />
              <span className="label-text">{m.admin_entities_visibility_private()}</span>
            </label>
          </FormField>
          {form.private ? (
            <FormField label={m.admin_entities_col_owner_subject()} className="text-xs">
              <select
                className="select select-bordered select-sm w-full"
                value={form.owner_subject_id}
                onChange={(e) => setForm((f) => ({ ...f, owner_subject_id: e.target.value }))}
              >
                <option value="">{m.admin_entities_owner_subject_placeholder()}</option>
                {subjects.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {subjectOptionLabel(s)}
                  </option>
                ))}
              </select>
            </FormField>
          ) : null}
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
            disabled={
              saving || !form.title.trim() || (form.private && !form.owner_subject_id.trim())
            }
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
      if (id == null) return m.admin_common_empty();
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
      const payload = {
        title: form.title.trim(),
        summary: form.summary.trim(),
        content: form.content.trim(),
        private: form.private,
        owner_subject_id: ownerSubjectId,
      };
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
          <h2 className="text-lg font-bold">{m.admin_nav_worlds()}</h2>
          <p className="text-sm text-base-content/60 mt-1">{m.admin_entities_worlds_desc()}</p>
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
            {m.admin_entities_new_world()}
          </button>
        </div>
      </div>

      {error ? <div className="alert alert-error text-sm mb-4">{error}</div> : null}

      {loading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-dots loading-md" />
        </div>
      ) : items.length === 0 ? (
        <div className="alert alert-info text-sm">{m.admin_entities_worlds_empty()}</div>
      ) : (
        <div className="card bg-base-200">
          <div className="card-body p-0 overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>{m.admin_entities_col_id()}</th>
                  <th>{m.admin_entities_col_title()}</th>
                  <th>{m.admin_entities_col_summary()}</th>
                  <th>{m.admin_entities_col_visibility()}</th>
                  <th>{m.admin_entities_col_owner_subject()}</th>
                  <th>{m.admin_common_time()}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const access = readWorldBody(row);
                  return (
                    <tr key={row.id}>
                      <td className="font-mono text-xs">{row.id}</td>
                      <td className="max-w-[12rem] truncate">
                        {row.title || m.admin_common_no_title()}
                      </td>
                      <td className="max-w-[16rem] truncate text-base-content/70">
                        {row.summary || m.admin_common_empty()}
                      </td>
                      <td className="text-xs">
                        {access.private
                          ? access.default_private
                            ? m.admin_entities_world_default_private_badge()
                            : m.admin_entities_visibility_private()
                          : m.admin_entities_visibility_public()}
                      </td>
                      <td className="text-xs max-w-[12rem] truncate">
                        {access.private
                          ? subjectTitleById(access.owner_subject_id)
                          : m.admin_common_empty()}
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
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-2 text-xs text-base-content/60 border-t border-base-300/50">
              {total} {m.admin_entities_worlds_count_label()}
            </div>
          </div>
        </div>
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
