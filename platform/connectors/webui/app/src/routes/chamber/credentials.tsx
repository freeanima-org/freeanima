import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getCredentialDetail, listCredentials } from "@/lib/api.ts";
import { m } from "@/lib/i18n.ts";

type CredentialMeta = {
  path: string;
  category: string;
  name: string;
  label: string;
  yaml: boolean;
  fields: string[];
  tags: string[];
  desc: string;
};

type CredentialDetail =
  | { yaml: true; fields: Record<string, unknown> }
  | { yaml: false; value: string };

type CredentialsLoaderData = {
  credentials: CredentialMeta[];
};

const EMPTY_LOADER_DATA: CredentialsLoaderData = { credentials: [] };

export const Route = createFileRoute("/chamber/credentials")({
  loader: () => listCredentials().catch(() => EMPTY_LOADER_DATA) as Promise<CredentialsLoaderData>,
  component: CredentialsPage,
});

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

function CredentialCard({ cred, onView }: { cred: CredentialMeta; onView: () => void }) {
  return (
    <div className="card bg-base-200">
      <div className="card-body py-3 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-mono text-sm font-bold">{cred.path}</h3>
          <div className="flex gap-1 flex-wrap items-center">
            {cred.yaml ? <span className="badge badge-info badge-xs">YAML</span> : null}
            {cred.tags.map((tag) => (
              <span key={tag} className="badge badge-ghost badge-xs">
                {tag}
              </span>
            ))}
            <button type="button" className="btn btn-xs btn-outline" onClick={onView}>
              {m.webui_chamber_credentials_view_detail()}
            </button>
          </div>
        </div>
        {cred.desc ? <p className="text-xs text-base-content/60 mt-1">{cred.desc}</p> : null}
        {cred.fields.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {cred.fields.map((field) => (
              <code key={field} className="text-xs bg-base-300 px-1.5 py-0.5 rounded">
                {field}
              </code>
            ))}
          </div>
        ) : (
          <p className="text-xs text-base-content/40 mt-1">
            {m.webui_chamber_credentials_no_structured_fields()}
          </p>
        )}
      </div>
    </div>
  );
}

function CredentialDetailModal({
  path,
  detail,
  loading,
  error,
  onClose,
}: {
  path: string;
  detail: CredentialDetail | null;
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-base-100 rounded-xl p-5 shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-bold mb-1">{m.webui_chamber_credentials_detail_title()}</h3>
        <p className="font-mono text-xs text-base-content/60 mb-3 break-all">{path}</p>

        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-dots loading-md" />
            </div>
          ) : error ? (
            <div className="alert alert-error text-sm">{error}</div>
          ) : detail?.yaml ? (
            <div className="space-y-3">
              {Object.entries(detail.fields).map(([field, value]) => {
                const text = formatFieldValue(value);
                return (
                  <div key={field} className="border border-base-300 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <code className="text-xs font-bold">{field}</code>
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost"
                        onClick={() => void copyText(text)}
                      >
                        {m.webui_common_copy()}
                      </button>
                    </div>
                    <pre className="text-xs whitespace-pre-wrap break-all font-mono bg-base-200 p-2 rounded">
                      {text}
                    </pre>
                  </div>
                );
              })}
            </div>
          ) : detail ? (
            <div>
              <div className="flex justify-end mb-1">
                <button
                  type="button"
                  className="btn btn-xs btn-ghost"
                  onClick={() => void copyText(detail.value)}
                >
                  {m.webui_common_copy()}
                </button>
              </div>
              <pre className="text-xs whitespace-pre-wrap break-all font-mono bg-base-200 p-3 rounded">
                {detail.value}
              </pre>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className="btn btn-sm" onClick={onClose}>
            {m.webui_common_close()}
          </button>
        </div>
      </div>
    </div>
  );
}

function CredentialsPage() {
  const data = Route.useLoaderData();
  const credentials = data.credentials ?? [];
  const [modalPath, setModalPath] = useState<string | null>(null);
  const [detail, setDetail] = useState<CredentialDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const openDetail = async (path: string) => {
    setModalPath(path);
    setDetail(null);
    setError("");
    setLoading(true);
    try {
      const result = (await getCredentialDetail(path)) as CredentialDetail;
      setDetail(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setModalPath(null);
    setDetail(null);
    setError("");
    setLoading(false);
  };

  const byCategory = new Map<string, CredentialMeta[]>();
  for (const cred of credentials) {
    const cat = cred.category || m.webui_chamber_credentials_uncategorized();
    const list = byCategory.get(cat);
    if (list) list.push(cred);
    else byCategory.set(cat, [cred]);
  }

  const categories = [...byCategory.entries()].toSorted(([a], [b]) => a.localeCompare(b));

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold">{m.webui_chamber_nav_credentials()}</h2>
        <p className="text-sm text-base-content/60 mt-1">
          {m.webui_chamber_credentials_desc()}
          {credentials.length > 0
            ? ` ${m.webui_chamber_credentials_count({ count: String(credentials.length) })}`
            : null}
        </p>
      </div>

      {credentials.length === 0 ? (
        <div className="alert alert-info text-sm">{m.webui_chamber_credentials_empty()}</div>
      ) : (
        <div className="space-y-6">
          {categories.map(([category, creds]) => (
            <div key={category}>
              <h3 className="text-sm font-bold text-base-content/50 mb-2 uppercase tracking-wide">
                📁 {category}
              </h3>
              <div className="space-y-2">
                {creds.map((cred) => (
                  <CredentialCard
                    key={cred.path}
                    cred={cred}
                    onView={() => void openDetail(cred.path)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalPath ? (
        <CredentialDetailModal
          path={modalPath}
          detail={detail}
          loading={loading}
          error={error}
          onClose={closeModal}
        />
      ) : null}
    </div>
  );
}
