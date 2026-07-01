import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@freeanima/ui-kit";
import { FormField } from "@freeanima/ui-kit/form";
import { StatusAlert } from "@freeanima/ui-kit/composite";
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
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-2xl safe-area-pt safe-area-pb">
        <DialogHeader>
          <DialogTitle>
            {m.admin_entities_api_tokens_title({ subject: subjectLabel(subject) })}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{m.admin_entities_api_tokens_desc()}</p>

        {error ? (
          <StatusAlert variant="error" className="mb-3">
            {error}
          </StatusAlert>
        ) : null}

        {plaintext ? (
          <StatusAlert variant="warning" className="mb-4">
            <div>
              <p className="font-semibold">{m.admin_entities_api_token_plaintext_title()}</p>
              <p className="mt-1">{m.admin_entities_api_token_plaintext_hint()}</p>
              <code className="block mt-2 p-2 rounded bg-muted text-xs break-all">{plaintext}</code>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button type="button" size="sm" onClick={() => void onCopyPlaintext()}>
                  {m.admin_common_copy()}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPlaintext(null);
                    setCopyHint("");
                  }}
                >
                  {m.admin_common_close()}
                </Button>
              </div>
              {copyHint ? <p className="text-xs mt-2 opacity-80">{copyHint}</p> : null}
            </div>
          </StatusAlert>
        ) : null}

        <div className="flex flex-wrap gap-2 items-end mb-4">
          <FormField
            label={m.admin_entities_api_token_new()}
            className="text-xs flex-1 min-w-[12rem]"
          >
            <Input
              type="text"
              className="w-full h-8"
              placeholder={m.admin_entities_api_token_name_placeholder()}
              value={name}
              disabled={creating}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
          <Button
            type="button"
            size="sm"
            disabled={creating || !name.trim()}
            onClick={() => void onCreate()}
          >
            {creating ? <Spinner /> : m.admin_entities_api_token_create()}
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <StatusAlert variant="info">{m.admin_entities_api_tokens_empty()}</StatusAlert>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{m.admin_entities_api_token_col_name()}</TableHead>
                  <TableHead>{m.admin_entities_api_token_col_prefix()}</TableHead>
                  <TableHead>{m.admin_entities_api_token_col_scopes()}</TableHead>
                  <TableHead>{m.admin_entities_api_token_col_status()}</TableHead>
                  <TableHead>{m.admin_entities_api_token_col_last_used()}</TableHead>
                  <TableHead>{m.admin_common_time()}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((token) => (
                  <TableRow key={token.id}>
                    <TableCell>{token.name}</TableCell>
                    <TableCell className="font-mono text-xs">{token.prefix}</TableCell>
                    <TableCell className="text-xs">
                      {token.scopes.join(", ") || m.admin_common_empty()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={token.revoked_at ? "ghost" : "success"} className="text-xs">
                        {tokenStatusLabel(token)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {token.last_used_at
                        ? formatDisplayDateTime(token.last_used_at)
                        : m.admin_common_empty()}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDisplayDateTime(token.created_at)}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive"
                        disabled={Boolean(token.revoked_at) || revokingId === token.id}
                        onClick={() => void onRevoke(token)}
                      >
                        {revokingId === token.id ? (
                          <Spinner />
                        ) : (
                          m.admin_entities_api_token_revoke()
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {m.admin_common_close()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
