import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
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
import { showConfirm, StatusAlert } from "@freeanima/ui-kit/composite";
import { copyText } from "@freeanima/ui-kit/lib/copy-text.ts";
import { formatDisplayDateTime } from "@freeanima/features/habitat/ui/habitat/lib/format-datetime.ts";
import {
  getSubjectEntity,
  listSubjectApiTokens,
  revealSubjectApiToken,
  revokeSubjectApiToken,
  updateSubjectApiTokenName,
  type EntityRow,
  type ServiceApiTokenPublic,
} from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import {
  catchWithFallback,
  logCaughtError,
} from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";

export const Route = createFileRoute("/_sidebar/subjects/$subjectId/tokens/")({
  loader: async ({ params }) => {
    const subjectId = Number(params.subjectId);
    const subject = await getSubjectEntity(subjectId).catch(
      catchWithFallback("subjects/$subjectId/tokens/getSubject", null as EntityRow | null),
    );
    return { subjectId, subject };
  },
  component: SubjectApiTokensPage,
});

function formatTokenAuthorization(token: ServiceApiTokenPublic): string {
  const authz = token.authorization;
  if (authz.full) return "full";
  const worlds = authz.data.allowed_worlds.map(String).join("|") || "*";
  return `${authz.portal}; modules=${authz.modules.join(",")}; access=${authz.data.access}; worlds=${worlds}`;
}

function isActiveToken(token: ServiceApiTokenPublic): boolean {
  if (token.revoked_at) return false;
  if (token.expires_at && new Date(token.expires_at).getTime() <= Date.now()) return false;
  return true;
}

function SubjectApiTokensPage() {
  const { subjectId, subject } = Route.useLoaderData();
  const [items, setItems] = useState<ServiceApiTokenPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [copyingId, setCopyingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState("");
  const [showAll, setShowAll] = useState(false);

  const title = subject?.title?.trim() || `主体 #${subjectId}`;

  const visibleItems = useMemo(
    () => (showAll ? items : items.filter(isActiveToken)),
    [items, showAll],
  );

  const fetchTokens = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listSubjectApiTokens(subjectId);
      setItems(data.items);
    } catch (e) {
      logCaughtError("subjects/$subjectId/tokens/list", e);
      setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    void fetchTokens();
  }, [fetchTokens]);

  const onCopyPlaintext = async (text: string) => {
    const ok = await copyText(text);
    setCopyHint(ok ? "已复制 API 令牌" : "复制 API 令牌失败");
  };

  const onRevealAndCopy = async (token: ServiceApiTokenPublic) => {
    setCopyingId(token.id);
    setError("");
    try {
      const result = await revealSubjectApiToken(token.id);
      setPlaintext(result.plaintext);
      await onCopyPlaintext(result.plaintext);
    } catch (e) {
      logCaughtError("subjects/$subjectId/tokens/reveal", e);
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

  const onRename = async (token: ServiceApiTokenPublic) => {
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
      logCaughtError("subjects/$subjectId/tokens/rename", e);
      setError(`操作失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRenamingId(null);
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
      logCaughtError("subjects/$subjectId/tokens/revoke", e);
      setError(`操作失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground mb-1">
            <Link to="/subjects" className="underline-offset-2 hover:underline">
              {"主体"}
            </Link>
            {" / "}
            {title}
          </div>
          <h1 className="text-xl font-semibold">{"服务 API 令牌"}</h1>
          <p className="text-sm text-muted-foreground">
            {"绑定到此主体。可改名、复制明文；创建后授权不可改，需吊销再建。"}
          </p>
        </div>
        <Link
          to="/subjects/$subjectId/tokens/create"
          params={{ subjectId: String(subjectId) }}
          className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground"
        >
          {"创建令牌"}
        </Link>
      </div>

      {error ? <StatusAlert variant="error">{error}</StatusAlert> : null}

      {plaintext ? (
        <StatusAlert variant="warning">
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

      <div className="flex items-center justify-end gap-2">
        <Label htmlFor="subject-api-tokens-show-all" className="text-xs text-muted-foreground">
          {"显示已吊销"}
        </Label>
        <Switch id="subject-api-tokens-show-all" isSelected={showAll} onChange={setShowAll} />
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : visibleItems.length === 0 ? (
        <StatusAlert variant="info">{"尚无令牌。"}</StatusAlert>
      ) : (
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[18%]">{"名称"}</TableHead>
              <TableHead className="w-[12%]">{"前缀"}</TableHead>
              <TableHead className="w-[28%]">{"授权"}</TableHead>
              <TableHead className="w-[10%]">{"状态"}</TableHead>
              <TableHead className="w-[14%]">{"最近使用"}</TableHead>
              <TableHead className="w-[18%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleItems.map((token) => (
              <TableRow key={token.id}>
                <TableCell className="whitespace-normal break-words">
                  {editingId === token.id ? (
                    <div className="flex flex-wrap gap-1 items-center">
                      <Input
                        className="h-7 text-xs min-w-[8rem]"
                        value={editingName}
                        disabled={renamingId === token.id}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void onRename(token);
                          if (e.key === "Escape") cancelEditName();
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs"
                        isDisabled={renamingId === token.id || !editingName.trim()}
                        onClick={() => void onRename(token)}
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
                      {isActiveToken(token) ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => startEditName(token)}
                        >
                          {"改名"}
                        </Button>
                      ) : null}
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs whitespace-normal break-all">
                  {token.prefix}
                </TableCell>
                <TableCell className="text-xs whitespace-normal break-words">
                  {formatTokenAuthorization(token)}
                </TableCell>
                <TableCell>
                  <Badge variant={token.revoked_at ? "ghost" : "success"} className="text-xs">
                    {token.revoked_at ? "已吊销" : "运行中"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {token.last_used_at ? formatDisplayDateTime(token.last_used_at) : "（空）"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {isActiveToken(token) ? (
                      <>
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive"
                          isDisabled={revokingId === token.id}
                          onClick={() => void onRevoke(token)}
                        >
                          {revokingId === token.id ? <Spinner /> : "吊销"}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
