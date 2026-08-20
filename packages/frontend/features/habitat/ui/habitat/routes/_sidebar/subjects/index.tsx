import { omitUndefined } from "@freeanima/features/habitat/ui/habitat/lib/omit-undefined.ts";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
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
import { FormField, FormFieldset } from "@freeanima/ui-kit/form/FormFieldset.tsx";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { formatDisplayDateTime } from "@freeanima/features/habitat/ui/habitat/lib/format-datetime.ts";
import {
  createSubjectEntity,
  getHabitatIdentityPublic,
  listSubjectEntities,
  listWorldEntities,
  updateSubjectEntity,
  type EntityRow,
  type HabitatIdentityPublic,
} from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { logCaughtError } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";
import { copyText } from "@freeanima/ui-kit/lib/copy-text.ts";
import { formatAnimaUri } from "@freeanima/client/portal-sdk/anima-uri.ts";

export const Route = createFileRoute("/_sidebar/subjects/")({
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

function readSubjectPublicId(row: EntityRow): string {
  const v = row.body?.public_id;
  return typeof v === "string" ? v.trim() : "";
}

function readSubjectPublicKey(row: EntityRow): string {
  const v = row.body?.public_key;
  return typeof v === "string" ? v.trim() : "";
}

function CopyableMono({ label, value }: { label: string; value: string }) {
  const [hint, setHint] = useState("");
  if (!value) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">{"（尚未生成）"}</p>
      </div>
    );
  }
  return (
    <div className="space-y-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-xs"
          onClick={() => {
            void (async () => {
              const ok = await copyText(value);
              setHint(ok ? "已复制" : "复制失败");
              setTimeout(() => setHint(""), 1500);
            })();
          }}
        >
          {"复制"}
        </Button>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      <p className="font-mono text-xs break-all select-all">{value}</p>
    </div>
  );
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
  const title = row.title || "（无标题）";
  const suffix = row.body?.default_private === true ? ` (默认私有)` : "";
  return `#${row.id} — ${title}${suffix}`;
}

function SubjectEditModal({
  mode,
  initial,
  candidateWorlds,
  entityId,
  identityPublicId,
  identityPublicKey,
  habitatInstanceId,
  saving,
  error,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  initial: SubjectFormState;
  candidateWorlds: EntityRow[];
  entityId?: number;
  identityPublicId?: string;
  identityPublicKey?: string;
  habitatInstanceId?: string;
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

  const crossUri =
    mode === "edit" && entityId != null && habitatInstanceId
      ? formatAnimaUri({ id: entityId, habitat_instance_id: habitatInstanceId })
      : "";

  return (
    <Dialog
      isOpen
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      className="max-w-lg safe-area-pt safe-area-pb"
    >
      <DialogHeader>
        <DialogTitle>{mode === "create" ? "新建主体" : "编辑主体"}</DialogTitle>
      </DialogHeader>
      {error ? (
        <StatusAlert variant="error" className="mb-3">
          {error}
        </StatusAlert>
      ) : null}
      <FormFieldset bordered={false} className="gap-3">
        {mode === "create" ? (
          <FormField label={"类型"} className="text-xs">
            <Select
              selectedKey={form.type}
              onSelectionChange={(key) => {
                if (key == null) return;
                const v = String(key);
                setForm((f) => ({
                  ...f,
                  type: v === "user" ? "user" : "agent",
                }));
              }}
            >
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem id="agent">{"Agent"}</SelectItem>
                <SelectItem id="user">{"用户"}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        ) : null}
        <FormField label={"标题"} className="text-xs">
          <Input
            type="text"
            className="w-full h-8"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </FormField>
        <FormField label={"摘要"} className="text-xs">
          <Input
            type="text"
            className="w-full h-8"
            value={form.summary}
            onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
          />
        </FormField>
        <FormField label={"内容"} className="text-xs">
          <Textarea
            className="w-full min-h-24"
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
          />
        </FormField>
        {mode === "edit" ? (
          <>
            <FormField label={"默认私有世界"} className="text-xs">
              {candidateWorlds.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">{"该主体暂无私有世界。"}</p>
              ) : (
                <Select
                  selectedKey={form.default_private_world_id}
                  onSelectionChange={(key) => {
                    if (key != null) {
                      setForm((f) => ({ ...f, default_private_world_id: String(key) }));
                    }
                  }}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {candidateWorlds.map((w) => (
                      <SelectItem key={w.id} id={String(w.id)}>
                        {worldOptionLabel(w)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <div className="rounded-md border border/60 bg-muted/40 p-3 space-y-3">
              <p className="text-xs font-medium">{"公开身份（只读）"}</p>
              <CopyableMono label="实体 id" value={entityId != null ? String(entityId) : ""} />
              <CopyableMono label="public_id" value={identityPublicId ?? ""} />
              <CopyableMono label="公钥" value={identityPublicKey ?? ""} />
              {crossUri ? <CopyableMono label="跨机引用" value={crossUri} /> : null}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">{"将自动创建默认私有世界。"}</p>
        )}
      </FormFieldset>
      <DialogFooter>
        <Button type="button" variant="ghost" size="sm" isDisabled={saving} onClick={onClose}>
          {"取消"}
        </Button>
        <Button
          type="button"
          size="sm"
          isDisabled={saving || !form.title.trim()}
          onClick={() => onSave(form)}
        >
          {saving ? <Spinner /> : "保存"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function subjectTypeLabel(type: string): string {
  if (type === "agent") return "Agent";
  if (type === "user") return "用户";
  return type;
}

function SubjectsPage() {
  const [items, setItems] = useState<EntityRow[]>([]);
  const [worlds, setWorlds] = useState<EntityRow[]>([]);
  const [habitatIdentity, setHabitatIdentity] = useState<HabitatIdentityPublic | null>(null);
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
      if (id == null) return "（空）";
      const world = worlds.find((w) => w.id === id);
      return world?.title || `#${id}`;
    },
    [worlds],
  );

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [subjectData, worldData, identity] = await Promise.all([
        listSubjectEntities(),
        listWorldEntities(),
        getHabitatIdentityPublic().catch((e) => {
          logCaughtError("routes/_sidebar/subjects/identity", e);
          return null;
        }),
      ]);
      setItems(subjectData.items);
      setTotal(subjectData.total);
      setWorlds(worldData.items);
      setHabitatIdentity(identity);
    } catch (e) {
      logCaughtError("routes/_sidebar/subjects", e);
      setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
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
      setModalError(`操作失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold">{"👤 主体"}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {"Agent 与用户相互独立。每个主体会自动获得一个默认私有世界。"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 console-page-toolbar">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            isDisabled={loading}
            onClick={() => void fetchList()}
          >
            {"刷新"}
          </Button>
          <Button type="button" size="sm" onClick={openCreate}>
            {"新建主体"}
          </Button>
        </div>
      </div>

      {error ? (
        <StatusAlert variant="error" className="mb-4">
          {error}
        </StatusAlert>
      ) : null}

      {!loading ? (
        <Card className="bg-muted mb-4 py-0">
          <CardContent className="p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold">{"栖息地实例身份"}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {"只读公开信息；私钥仅服务端保存，不下发到壳。"}
              </p>
            </div>
            {habitatIdentity ? (
              <>
                <CopyableMono
                  label="habitat_instance_id"
                  value={habitatIdentity.habitat_instance_id}
                />
                <CopyableMono label="公钥" value={habitatIdentity.public_key} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {"尚未生成（需栖息地完成 identity boot）。"}
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <StatusAlert variant="info">{"暂无主体。请创建 agent 或 user 实体。"}</StatusAlert>
      ) : (
        <Card className="bg-muted py-0">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{"ID"}</TableHead>
                  <TableHead>{"类型"}</TableHead>
                  <TableHead>{"标题"}</TableHead>
                  <TableHead>{"public_id"}</TableHead>
                  <TableHead>{"默认私有世界"}</TableHead>
                  <TableHead>{"时间"}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => {
                  const publicId = readSubjectPublicId(row);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.id}</TableCell>
                      <TableCell>
                        <Badge variant="ghost" className="text-xs">
                          {subjectTypeLabel(row.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[10rem] truncate">
                        {row.title || "（无标题）"}
                      </TableCell>
                      <TableCell
                        className="font-mono text-xs max-w-[9rem] truncate"
                        title={publicId || undefined}
                      >
                        {publicId || "—"}
                      </TableCell>
                      <TableCell className="text-xs max-w-[10rem] truncate">
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
                            {"编辑"}
                          </Button>
                          <Link
                            to="/subjects/$subjectId/tokens"
                            params={{ subjectId: String(row.id) }}
                            className="inline-flex h-7 items-center rounded-md px-2 text-xs text-foreground hover:bg-muted"
                          >
                            {"API 令牌"}
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="px-4 py-2 text-xs text-muted-foreground border-t border/50">
              {total} {"主体"}
            </div>
          </CardContent>
        </Card>
      )}

      {modal ? (
        <SubjectEditModal
          mode={modal.mode}
          initial={modalInitial}
          candidateWorlds={modalCandidateWorlds}
          {...(modal.row
            ? {
                entityId: modal.row.id,
                identityPublicId: readSubjectPublicId(modal.row),
                identityPublicKey: readSubjectPublicKey(modal.row),
              }
            : {})}
          {...(habitatIdentity?.habitat_instance_id
            ? { habitatInstanceId: habitatIdentity.habitat_instance_id }
            : {})}
          saving={saving}
          error={modalError}
          onClose={closeModal}
          onSave={(form) => void onSave(form)}
        />
      ) : null}
    </div>
  );
}
