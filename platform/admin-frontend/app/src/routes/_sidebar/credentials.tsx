import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  Spinner,
} from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { getCredentialDetail, listCredentials } from "@admin/lib/api.ts";
import { m } from "@admin/lib/i18n.ts";
import { catchWithFallback, logCaughtError } from "@admin/lib/log-caught-error.ts";

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

export const Route = createFileRoute("/_sidebar/credentials")({
  loader: () =>
    listCredentials().catch(
      catchWithFallback("credentials/listCredentials", EMPTY_LOADER_DATA),
    ) as Promise<CredentialsLoaderData>,
  component: CredentialsPage,
});

function formatFieldValue(value: unknown): string {
  if (value == null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

function CredentialCard({ cred, onView }: { cred: CredentialMeta; onView: () => void }) {
  return (
    <Card className="bg-muted py-0">
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-mono text-sm font-bold">{cred.path}</h3>
          <div className="flex gap-1 flex-wrap items-center">
            {cred.yaml ? (
              <Badge variant="secondary" className="text-xs">
                YAML
              </Badge>
            ) : null}
            {cred.tags.map((tag) => (
              <Badge key={tag} variant="ghost" className="text-xs">
                {tag}
              </Badge>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={onView}
            >
              {m.admin_credentials_view_detail()}
            </Button>
          </div>
        </div>
        {cred.desc ? <p className="text-xs text-muted-foreground mt-1">{cred.desc}</p> : null}
        {cred.fields.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {cred.fields.map((field) => (
              <code key={field} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                {field}
              </code>
            ))}
          </div>
        ) : (
          <p className="text-xs text-foreground/40 mt-1">
            {m.admin_credentials_no_structured_fields()}
          </p>
        )}
      </CardContent>
    </Card>
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
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col safe-area-pt safe-area-pb">
        <DialogHeader>
          <DialogTitle>{m.admin_credentials_detail_title()}</DialogTitle>
        </DialogHeader>
        <p className="font-mono text-xs text-muted-foreground mb-3 break-all">{path}</p>

        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : error ? (
            <StatusAlert variant="error">{error}</StatusAlert>
          ) : detail?.yaml ? (
            <div className="space-y-3">
              {Object.entries(detail.fields).map(([field, value]) => {
                const text = formatFieldValue(value);
                return (
                  <div key={field} className="border border rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <code className="text-xs font-bold">{field}</code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => void copyText(text)}
                      >
                        {m.admin_common_copy()}
                      </Button>
                    </div>
                    <pre className="text-xs whitespace-pre-wrap break-all font-mono bg-muted p-2 rounded">
                      {text}
                    </pre>
                  </div>
                );
              })}
            </div>
          ) : detail ? (
            <div>
              <div className="flex justify-end mb-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => void copyText(detail.value)}
                >
                  {m.admin_common_copy()}
                </Button>
              </div>
              <pre className="text-xs whitespace-pre-wrap break-all font-mono bg-muted p-3 rounded">
                {detail.value}
              </pre>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" size="sm" onClick={onClose}>
            {m.admin_common_close()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      logCaughtError("routes/_sidebar/credentials", e);
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
    const cat = cred.category || m.admin_credentials_uncategorized();
    const list = byCategory.get(cat);
    if (list) list.push(cred);
    else byCategory.set(cat, [cred]);
  }

  const categories = [...byCategory.entries()].toSorted(([a], [b]) => a.localeCompare(b));

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold">{m.admin_nav_credentials()}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {m.admin_credentials_desc()}
          {credentials.length > 0
            ? ` ${m.admin_credentials_count({ count: String(credentials.length) })}`
            : null}
        </p>
      </div>

      {credentials.length === 0 ? (
        <StatusAlert variant="info">{m.admin_credentials_empty()}</StatusAlert>
      ) : (
        <div className="space-y-6">
          {categories.map(([category, creds]) => (
            <div key={category}>
              <h3 className="text-sm font-bold text-muted-foreground mb-2 uppercase tracking-wide">
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
