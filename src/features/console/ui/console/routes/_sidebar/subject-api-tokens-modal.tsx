import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Spinner,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@freeanima/ui-kit";
import { FormField } from "@freeanima/ui-kit/form";
import { showConfirm, StatusAlert } from "@freeanima/ui-kit/composite";
import { copyText } from "@freeanima/ui-kit/lib/copy-text";
import { formatDisplayDateTime } from "@console/lib/format-datetime.ts";
import { m } from "@console/lib/i18n.ts";
import {
  createSubjectApiToken,
  listSubjectApiTokens,
  revokeSubjectApiToken,
  type EntityRow,
  type ServiceApiTokenPublic,
} from "@console/lib/api.ts";
import { logCaughtError } from "@console/lib/log-caught-error.ts";

function subjectLabel(row: EntityRow): string {
  const title = row.title || m.console_common_no_title();
  return `#${row.id} — ${title}`;
}

function tokenStatusLabel(token: ServiceApiTokenPublic): string {
  if (token.revoked_at) return m.console_entities_api_token_status_revoked();
  return m.console_entities_api_token_status_active();
}

function isActiveToken(token: ServiceApiTokenPublic): boolean {
  if (token.revoked_at) return false;
  if (token.expires_at && new Date(token.expires_at).getTime() <= Date.now()) return false;
  return true;
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
  const [showAll, setShowAll] = useState(false);

  const visibleItems = useMemo(
    () => (showAll ? items : items.filter(isActiveToken)),
    [items, showAll],
  );

  const fetchTokens = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listSubjectApiTokens(subject.id);
      setItems(data.items);
    } catch (e) {
      logCaughtError("routes/_sidebar/subject-api-tokens-modal", e);
      setError(
        m.console_common_load_failed({
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
        m.console_common_operation_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setCreating(false);
    }
  };

  const onRevoke = async (token: ServiceApiTokenPublic) => {
    if (token.revoked_at) return;
    const confirmed = await showConfirm({
      description: m.console_entities_api_token_revoke_confirm({ name: token.name }),
      confirmLabel: m.console_entities_api_token_revoke(),
      variant: "error",
    });
    if (!confirmed) return;
    setRevokingId(token.id);
    setError("");
    try {
      await revokeSubjectApiToken(token.id);
      await fetchTokens();
    } catch (e) {
      logCaughtError("routes/_sidebar/subject-api-tokens-modal/revoke", e);
      setError(
        m.console_common_operation_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setRevokingId(null);
    }
  };

  const onCopyPlaintext = async () => {
    if (!plaintext) return;
    const ok = await copyText(plaintext);
    setCopyHint(
      ok
        ? m.console_common_copied({ label: m.console_entities_api_tokens() })
        : m.console_common_copy_failed({ label: m.console_entities_api_tokens() }),
    );
    if (!ok)
      logCaughtError("routes/_sidebar/subject-api-tokens-modal/copy", new Error("copyText failed"));
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-4xl w-[calc(100%-2rem)] sm:max-w-4xl max-h-[85vh] flex flex-col overflow-hidden safe-area-pt safe-area-pb">
        <DialogHeader>
          <DialogTitle>
            {m.console_entities_api_tokens_title({ subject: subjectLabel(subject) })}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground shrink-0">
          {m.console_entities_api_tokens_desc()}
        </p>

        {error ? (
          <StatusAlert variant="error" className="mb-3 shrink-0">
            {error}
          </StatusAlert>
        ) : null}

        {plaintext ? (
          <StatusAlert variant="warning" className="mb-4 shrink-0">
            <div>
              <p className="font-semibold">{m.console_entities_api_token_plaintext_title()}</p>
              <p className="mt-1">{m.console_entities_api_token_plaintext_hint()}</p>
              <code className="block mt-2 p-2 rounded bg-muted text-xs break-all">{plaintext}</code>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button type="button" size="sm" onClick={() => void onCopyPlaintext()}>
                  {m.console_common_copy()}
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
                  {m.console_common_close()}
                </Button>
              </div>
              {copyHint ? <p className="text-xs mt-2 opacity-80">{copyHint}</p> : null}
            </div>
          </StatusAlert>
        ) : null}

        <div className="flex flex-wrap gap-2 items-end mb-4 shrink-0">
          <FormField
            label={m.console_entities_api_token_new()}
            className="text-xs flex-1 min-w-[12rem]"
          >
            <Input
              type="text"
              className="w-full h-8"
              placeholder={m.console_entities_api_token_name_placeholder()}
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
            {creating ? <Spinner /> : m.console_entities_api_token_create()}
          </Button>
        </div>

        <div className="flex items-center justify-end gap-2 mb-2 shrink-0">
          <Label htmlFor="subject-api-tokens-show-all" className="text-xs text-muted-foreground">
            {m.console_entities_api_tokens_show_all()}
          </Label>
          <Switch id="subject-api-tokens-show-all" checked={showAll} onCheckedChange={setShowAll} />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden [&_[data-slot=table-container]]:overflow-x-hidden">
          {loading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : visibleItems.length === 0 ? (
            <StatusAlert variant="info">
              {showAll
                ? m.console_entities_api_tokens_empty()
                : m.console_entities_api_tokens_empty_active()}
            </StatusAlert>
          ) : (
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[18%]">
                    {m.console_entities_api_token_col_name()}
                  </TableHead>
                  <TableHead className="w-[14%]">
                    {m.console_entities_api_token_col_prefix()}
                  </TableHead>
                  <TableHead className="w-[12%]">
                    {m.console_entities_api_token_col_scopes()}
                  </TableHead>
                  <TableHead className="w-[10%]">
                    {m.console_entities_api_token_col_status()}
                  </TableHead>
                  <TableHead className="w-[18%]">
                    {m.console_entities_api_token_col_last_used()}
                  </TableHead>
                  <TableHead className="w-[18%]">{m.console_common_time()}</TableHead>
                  <TableHead className="w-[10%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleItems.map((token) => (
                  <TableRow key={token.id}>
                    <TableCell className="whitespace-normal break-words">{token.name}</TableCell>
                    <TableCell className="font-mono text-xs whitespace-normal break-all">
                      {token.prefix}
                    </TableCell>
                    <TableCell className="text-xs whitespace-normal break-words">
                      {token.scopes.join(", ") || m.console_common_empty()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={token.revoked_at ? "ghost" : "success"} className="text-xs">
                        {tokenStatusLabel(token)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {token.last_used_at
                        ? formatDisplayDateTime(token.last_used_at)
                        : m.console_common_empty()}
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
                          m.console_entities_api_token_revoke()
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter className="shrink-0">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {m.console_common_close()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
