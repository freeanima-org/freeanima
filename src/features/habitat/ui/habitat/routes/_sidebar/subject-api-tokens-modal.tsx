import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Dialog,
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
import { FormField } from "@freeanima/ui-kit/form/FormFieldset.tsx";
import { showConfirm, StatusAlert } from "@freeanima/ui-kit/composite";
import { copyText } from "@freeanima/ui-kit/lib/copy-text.ts";
import { formatDisplayDateTime } from "@freeanima/features/habitat/ui/habitat/lib/format-datetime.ts";
import {
  createSubjectApiToken,
  listSubjectApiTokens,
  revealSubjectApiToken,
  revokeSubjectApiToken,
  updateSubjectApiTokenName,
  type EntityRow,
  type ServiceApiTokenPublic,
} from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { logCaughtError } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";

function subjectLabel(row: EntityRow): string {
  const title = row.title || "（无标题）";
  return `#${row.id} — ${title}`;
}

function tokenStatusLabel(token: ServiceApiTokenPublic): string {
  if (token.revoked_at) return "已吊销";
  return "运行中";
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
  const [copyingId, setCopyingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [renamingId, setRenamingId] = useState<number | null>(null);
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
      setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [subject.id]);

  useEffect(() => {
    void fetchTokens();
  }, [fetchTokens]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !creating && revokingId == null && renamingId == null) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [creating, onClose, renamingId, revokingId]);

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
      setError(`操作失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCreating(false);
    }
  };

  const onRevoke = async (token: ServiceApiTokenPublic) => {
    if (token.revoked_at) return;
    const confirmed = await showConfirm({
      description: `吊销令牌「${token.name}」？`,
      confirmLabel: "吊销",
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
      setError(`操作失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRevokingId(null);
    }
  };

  const onCopyPlaintext = async (value: string) => {
    const ok = await copyText(value);
    setCopyHint(ok ? "已复制 API 令牌" : "复制 API 令牌失败");
    if (!ok)
      logCaughtError("routes/_sidebar/subject-api-tokens-modal/copy", new Error("copyText failed"));
  };

  const onRevealAndCopy = async (token: ServiceApiTokenPublic) => {
    if (!token.revealable || !isActiveToken(token)) return;
    setCopyingId(token.id);
    setError("");
    setCopyHint("");
    try {
      const result = await revealSubjectApiToken(token.id);
      setPlaintext(result.plaintext);
      await onCopyPlaintext(result.plaintext);
    } catch (e) {
      logCaughtError("routes/_sidebar/subject-api-tokens-modal/reveal", e);
      setError(`操作失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCopyingId(null);
    }
  };

  const startEditName = (token: ServiceApiTokenPublic) => {
    setEditingId(token.id);
    setEditingName(token.name);
  };

  const cancelEditName = () => {
    setEditingId(null);
    setEditingName("");
  };

  const onSaveName = async (token: ServiceApiTokenPublic) => {
    const trimmed = editingName.trim();
    if (!trimmed || trimmed === token.name) {
      cancelEditName();
      return;
    }
    setRenamingId(token.id);
    setError("");
    try {
      const result = await updateSubjectApiTokenName(token.id, trimmed);
      setItems((prev) => prev.map((row) => (row.id === token.id ? result.token : row)));
      cancelEditName();
    } catch (e) {
      logCaughtError("routes/_sidebar/subject-api-tokens-modal/rename", e);
      setError(`操作失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRenamingId(null);
    }
  };

  return (
    <Dialog
      isOpen
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      className="max-w-4xl w-[calc(100%-2rem)] sm:max-w-4xl h-[85vh] flex flex-col overflow-hidden safe-area-pt safe-area-pb"
    >
      <DialogHeader className="shrink-0">
        <DialogTitle>{`服务 API 令牌 — ${subjectLabel(subject)}`}</DialogTitle>
      </DialogHeader>
      <p className="text-sm text-muted-foreground shrink-0">
        {"服务令牌绑定到此主体。可随时再次复制明文；旧版令牌若无法复制请重建。"}
      </p>

      {error ? (
        <StatusAlert variant="error" className="mb-3 shrink-0">
          {error}
        </StatusAlert>
      ) : null}

      {plaintext ? (
        <StatusAlert variant="warning" className="mb-4 shrink-0">
          <div>
            <p className="font-semibold">{"令牌明文"}</p>
            <p className="mt-1">{"请粘贴到客户端连接设置（Service API Token）。"}</p>
            <code className="block mt-2 p-2 rounded bg-muted text-xs break-all">{plaintext}</code>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button type="button" size="sm" onClick={() => void onCopyPlaintext(plaintext)}>
                {"复制"}
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
                {"关闭"}
              </Button>
            </div>
            {copyHint ? <p className="text-xs mt-2 opacity-80">{copyHint}</p> : null}
          </div>
        </StatusAlert>
      ) : null}

      <div className="flex flex-wrap gap-2 items-end mb-4 shrink-0">
        <FormField label={"新令牌"} className="text-xs flex-1 min-w-[12rem]">
          <Input
            type="text"
            className="w-full h-8"
            placeholder={"例如 desktop、mcp"}
            value={name}
            disabled={creating}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>
        <Button
          type="button"
          size="sm"
          isDisabled={creating || !name.trim()}
          onClick={() => void onCreate()}
        >
          {creating ? <Spinner /> : "创建令牌"}
        </Button>
      </div>

      <div className="flex items-center justify-end gap-2 mb-2 shrink-0">
        <Label htmlFor="subject-api-tokens-show-all" className="text-xs text-muted-foreground">
          {"停止全部"}
        </Label>
        <Switch id="subject-api-tokens-show-all" isSelected={showAll} onChange={setShowAll} />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden [&_[data-slot=table-container]]:overflow-x-hidden">
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : visibleItems.length === 0 ? (
          <StatusAlert variant="info">{showAll ? "尚无令牌。" : "尚无令牌。"}</StatusAlert>
        ) : (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[22%]">{"名称"}</TableHead>
                <TableHead className="w-[12%]">{"前缀"}</TableHead>
                <TableHead className="w-[10%]">{"范围"}</TableHead>
                <TableHead className="w-[10%]">{"状态"}</TableHead>
                <TableHead className="w-[16%]">{"最近使用"}</TableHead>
                <TableHead className="w-[16%]">{"时间"}</TableHead>
                <TableHead className="w-[14%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleItems.map((token) => (
                <TableRow key={token.id}>
                  <TableCell className="whitespace-normal break-words">
                    {editingId === token.id ? (
                      <div className="flex flex-wrap gap-1 items-center">
                        <Input
                          type="text"
                          className="h-7 text-xs flex-1 min-w-[6rem]"
                          value={editingName}
                          disabled={renamingId === token.id}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void onSaveName(token);
                            }
                            if (e.key === "Escape") {
                              e.preventDefault();
                              cancelEditName();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 text-xs"
                          isDisabled={renamingId === token.id || !editingName.trim()}
                          onClick={() => void onSaveName(token)}
                        >
                          {renamingId === token.id ? <Spinner /> : "保存"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          isDisabled={renamingId === token.id}
                          onClick={cancelEditName}
                        >
                          {"取消"}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1 items-center">
                        <span>{token.name}</span>
                        {!token.revoked_at ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => startEditName(token)}
                          >
                            {"编辑"}
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-normal break-all">
                    {token.prefix}
                  </TableCell>
                  <TableCell className="text-xs whitespace-normal break-words">
                    {token.scopes.join(", ") || "（空）"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={token.revoked_at ? "ghost" : "success"} className="text-xs">
                      {tokenStatusLabel(token)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {token.last_used_at ? formatDisplayDateTime(token.last_used_at) : "（空）"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDisplayDateTime(token.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {isActiveToken(token) ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          isDisabled={!token.revealable || copyingId === token.id}
                          title={token.revealable ? "复制明文" : "旧令牌无法再次复制，请重建"}
                          onClick={() => void onRevealAndCopy(token)}
                        >
                          {copyingId === token.id ? <Spinner /> : "复制"}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive"
                        isDisabled={Boolean(token.revoked_at) || revokingId === token.id}
                        onClick={() => void onRevoke(token)}
                      >
                        {revokingId === token.id ? <Spinner /> : "吊销"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <DialogFooter className="shrink-0">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          {"关闭"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
