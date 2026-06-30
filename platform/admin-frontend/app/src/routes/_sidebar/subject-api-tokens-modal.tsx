import { useCallback, useEffect, useState } from "react";
import { FormField } from "@freeanima/ui-kit/form";
import { formatDisplayDateTime } from "@admin/lib/format-datetime.ts";
import { m } from "@admin/lib/i18n.ts";
import {
  createSubjectApiToken,
  listSubjectApiTokens,
  revokeSubjectApiToken,
  type EntityRow,
  type ServiceApiTokenPublic,
} from "@admin/lib/api.ts";
import { logCaughtError } from "@admin/lib/log-caught-error.ts";

function subjectLabel(row: EntityRow): string {
  const title = row.title || m.admin_common_no_title();
  return `#${row.id} — ${title}`;
}

function tokenStatusLabel(token: ServiceApiTokenPublic): string {
  if (token.revoked_at) return m.admin_entities_api_token_status_revoked();
  return m.admin_entities_api_token_status_active();
}

export function SubjectApiTokensModal({
  subject,
  onClose,
}: {
  subject: EntityRow;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ServiceApiTokenPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState("");

  const fetchTokens = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listSubjectApiTokens(subject.id);
      setItems(data.items);
    } catch (e) {
      logCaughtError("routes/_sidebar/subject-api-tokens-modal", e);
      setError(
        m.admin_common_load_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [subject.id]);

  useEffect(() => {
    void fetchTokens();
  }, [fetchTokens]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !creating && revokingId == null) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [creating, onClose, revokingId]);

  const onCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    setError("");
    try {
      const result = await createSubjectApiToken(subject.id, { name: trimmed });
      setPlaintext(result.plaintext);
      setName("");
      await fetchTokens();
    } catch (e) {
      logCaughtError("routes/_sidebar/subject-api-tokens-modal/create", e);
      setError(
        m.admin_common_operation_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setCreating(false);
    }
  };

  const onRevoke = async (token: ServiceApiTokenPublic) => {
    if (token.revoked_at) return;
    if (!confirm(m.admin_entities_api_token_revoke_confirm({ name: token.name }))) return;
    setRevokingId(token.id);
    setError("");
    try {
      await revokeSubjectApiToken(token.id);
      await fetchTokens();
    } catch (e) {
      logCaughtError("routes/_sidebar/subject-api-tokens-modal/revoke", e);
      setError(
        m.admin_common_operation_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setRevokingId(null);
    }
  };

  const onCopyPlaintext = async () => {
    if (!plaintext) return;
    try {
      await navigator.clipboard.writeText(plaintext);
      setCopyHint(m.admin_common_copied({ label: m.admin_entities_api_tokens() }));
    } catch (e) {
      logCaughtError("routes/_sidebar/subject-api-tokens-modal/copy", e);
      setCopyHint(m.admin_common_copy_failed({ label: m.admin_entities_api_tokens() }));
    }
  };

  return (
    <dialog className="modal modal-open safe-area-pt safe-area-pb">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg mb-1">
          {m.admin_entities_api_tokens_title({ subject: subjectLabel(subject) })}
        </h3>
        <p className="text-sm text-base-content/60 mb-4">{m.admin_entities_api_tokens_desc()}</p>

        {error ? <div className="alert alert-error text-sm mb-3">{error}</div> : null}

        {plaintext ? (
          <div className="alert alert-warning text-sm mb-4">
            <div>
              <p className="font-semibold">{m.admin_entities_api_token_plaintext_title()}</p>
              <p className="mt-1">{m.admin_entities_api_token_plaintext_hint()}</p>
              <code className="block mt-2 p-2 rounded bg-base-300 text-xs break-all">
                {plaintext}
              </code>
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => void onCopyPlaintext()}
                >
                  {m.admin_common_copy()}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => {
                    setPlaintext(null);
                    setCopyHint("");
                  }}
                >
                  {m.admin_common_close()}
                </button>
              </div>
              {copyHint ? <p className="text-xs mt-2 opacity-80">{copyHint}</p> : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 items-end mb-4">
          <FormField
            label={m.admin_entities_api_token_new()}
            className="text-xs flex-1 min-w-[12rem]"
          >
            <input
              type="text"
              className="input input-bordered input-sm w-full"
              placeholder={m.admin_entities_api_token_name_placeholder()}
              value={name}
              disabled={creating}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={creating || !name.trim()}
            onClick={() => void onCreate()}
          >
            {creating ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              m.admin_entities_api_token_create()
            )}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <span className="loading loading-dots loading-md" />
          </div>
        ) : items.length === 0 ? (
          <div className="alert alert-info text-sm">{m.admin_entities_api_tokens_empty()}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>{m.admin_entities_api_token_col_name()}</th>
                  <th>{m.admin_entities_api_token_col_prefix()}</th>
                  <th>{m.admin_entities_api_token_col_scopes()}</th>
                  <th>{m.admin_entities_api_token_col_status()}</th>
                  <th>{m.admin_entities_api_token_col_last_used()}</th>
                  <th>{m.admin_common_time()}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((token) => (
                  <tr key={token.id}>
                    <td>{token.name}</td>
                    <td className="font-mono text-xs">{token.prefix}</td>
                    <td className="text-xs">{token.scopes.join(", ") || m.admin_common_empty()}</td>
                    <td>
                      <span
                        className={`badge badge-sm ${token.revoked_at ? "badge-ghost" : "badge-success badge-outline"}`}
                      >
                        {tokenStatusLabel(token)}
                      </span>
                    </td>
                    <td className="text-xs text-base-content/60">
                      {token.last_used_at
                        ? formatDisplayDateTime(token.last_used_at)
                        : m.admin_common_empty()}
                    </td>
                    <td className="text-xs text-base-content/60">
                      {formatDisplayDateTime(token.created_at)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost text-error"
                        disabled={Boolean(token.revoked_at) || revokingId === token.id}
                        onClick={() => void onRevoke(token)}
                      >
                        {revokingId === token.id ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          m.admin_entities_api_token_revoke()
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="modal-action">
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>
            {m.admin_common_close()}
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
