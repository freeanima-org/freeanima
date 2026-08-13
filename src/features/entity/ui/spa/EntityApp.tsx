import { useCallback, useEffect, useState } from "react";
import { SubjectScopeToggle, useSubjectScope } from "@freeanima/client/portal-sdk/react.tsx";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { formatDateTime } from "@freeanima/ui-kit/lib/datetime-local.ts";
import type { EntityAdminType } from "@freeanima/shared/rpc-contract/frames/entity.ts";
import { Boxes } from "lucide-react";

import { EntityDetailDialog } from "./components/EntityDetailDialog.tsx";
import {
  deleteEntity,
  fetchEntities,
  fetchEntityTrash,
  restoreEntity,
  type EntityAdminRow,
} from "./lib/api.ts";

const PAGE_SIZE = 20;
const TYPE_ALL = "__all__";
const ENTITY_TYPES: EntityAdminType[] = ["content", "world", "agent", "user"];

type EntityTab = "all" | "trash";

function ListPagination({
  total,
  pageSize,
  currentPage,
  loading,
  onPageChange,
}: {
  total: number;
  pageSize: number;
  currentPage: number;
  loading: boolean;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  return (
    <div className="flex items-center justify-between gap-2 border-t pt-2 text-xs">
      <span className="text-muted-foreground">
        共 {total} 条 · 第 {currentPage} / {pageCount} 页
      </span>
      <div className="inline-flex overflow-hidden rounded-md border shadow-xs">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 rounded-none border-0 px-2.5 text-xs"
          isDisabled={currentPage <= 1 || loading}
          onClick={() => onPageChange(currentPage - 1)}
        >
          上一页
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 rounded-none border-0 border-l px-2.5 text-xs"
          isDisabled={currentPage >= pageCount || loading}
          onClick={() => onPageChange(currentPage + 1)}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}

function EntityRowActions({
  row,
  tab,
  busy,
  onDelete,
  onRestore,
}: {
  row: EntityAdminRow;
  tab: EntityTab;
  busy: boolean;
  onDelete: (row: EntityAdminRow) => void | Promise<void>;
  onRestore: (row: EntityAdminRow) => void | Promise<void>;
}) {
  if (tab === "trash") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        isDisabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          void onRestore(row);
        }}
      >
        恢复
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      isDisabled={busy}
      onClick={(e) => {
        e.stopPropagation();
        void onDelete(row);
      }}
    >
      删除
    </Button>
  );
}

export function EntityApp() {
  const { kind: subjectKind } = useSubjectScope();
  const [tab, setTab] = useState<EntityTab>("all");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<EntityAdminRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<EntityAdminType | "">("");
  const [primaryComponent, setPrimaryComponent] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const hasActiveFilters =
    searchQuery.trim().length > 0 || typeFilter !== "" || primaryComponent.trim().length > 0;

  const fetchList = useCallback(
    async (nextOffset: number, nextTab: EntityTab) => {
      setLoading(true);
      setError("");
      try {
        const query = searchQuery.trim();
        const primary = primaryComponent.trim();
        const opts = {
          limit: PAGE_SIZE,
          offset: nextOffset,
          ...(typeFilter ? { type: typeFilter } : {}),
          ...(primary ? { primary_component: primary } : {}),
          ...(query ? { query } : {}),
        };
        const data = nextTab === "trash" ? await fetchEntityTrash(opts) : await fetchEntities(opts);
        setItems(data.items ?? []);
        setTotal(data.count ?? 0);
        setOffset(nextOffset);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [subjectKind, searchQuery, typeFilter, primaryComponent],
  );

  useEffect(() => {
    void fetchList(0, tab);
  }, [fetchList, tab]);

  const onPageChange = (page: number) => {
    void fetchList((page - 1) * PAGE_SIZE, tab);
  };

  const handleDelete = async (row: EntityAdminRow) => {
    setBusyId(row.id);
    setError("");
    try {
      const result = await deleteEntity(row.id);
      if (!result.ok) {
        const refs = result.references?.length ?? 0;
        setError(refs > 0 ? `实体仍被 ${refs} 处引用，暂无法删除` : "删除失败");
        return;
      }
      await fetchList(offset, tab);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleRestore = async (row: EntityAdminRow) => {
    setBusyId(row.id);
    setError("");
    try {
      await restoreEntity(row.id);
      await fetchList(offset, tab);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 md:px-6">
        <div className="flex items-center gap-2">
          <Boxes className="size-5 text-muted-foreground" aria-hidden />
          <div>
            <h1 className="text-lg font-semibold">实体</h1>
            <p className="text-sm text-muted-foreground">浏览与管理当前 world 下的实体</p>
          </div>
        </div>
        <SubjectScopeToggle />
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2 md:px-6">
        <Button
          type="button"
          variant={tab === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("all")}
        >
          全部
        </Button>
        <Button
          type="button"
          variant={tab === "trash" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("trash")}
        >
          回收站
        </Button>
        <span className="flex-1" />
        <Select
          selectedKey={typeFilter || TYPE_ALL}
          onSelectionChange={(key) => {
            if (key == null) return;
            const v = String(key);
            setTypeFilter(v === TYPE_ALL ? "" : (v as EntityAdminType));
          }}
        >
          <SelectTrigger size="sm" className="w-[8.5rem]">
            <SelectValue placeholder="类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem id={TYPE_ALL}>全部类型</SelectItem>
            {ENTITY_TYPES.map((t) => (
              <SelectItem key={t} id={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="h-8 w-full max-w-[10rem] sm:h-9"
          placeholder="主组件"
          value={primaryComponent}
          onChange={(e) => setPrimaryComponent(e.target.value)}
        />
        <Input
          className="h-8 w-full sm:h-9 sm:max-w-xs"
          placeholder="关键词、id 或 anima:id"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        {error ? (
          <StatusAlert variant="error" className="mb-4">
            {error}
          </StatusAlert>
        ) : null}

        {loading && items.length === 0 ? (
          <div className="flex justify-center py-12">
            <Spinner className="size-6" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {hasActiveFilters ? "无匹配实体" : tab === "trash" ? "回收站为空" : "暂无实体"}
          </p>
        ) : (
          <div className="space-y-2">
            <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 px-2 text-xs font-medium text-muted-foreground md:grid">
              <span>ID / 标题</span>
              <span>主组件</span>
              <span>组件</span>
              <span>{tab === "trash" ? "删除时间" : "更新时间"}</span>
              <span className="text-right">操作</span>
            </div>

            {items.map((row) => (
              <div
                key={row.id}
                role="button"
                tabIndex={0}
                className="hover:bg-muted/40 grid cursor-pointer gap-2 rounded-lg border bg-card p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center md:gap-3"
                onClick={() => setDetailId(row.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDetailId(row.id);
                  }
                }}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">#{row.id}</div>
                  <div className="truncate text-sm">{row.title || row.summary || "—"}</div>
                  <div className="text-xs text-muted-foreground">{row.type}</div>
                </div>
                <div className="truncate text-sm">{row.primary_component ?? "—"}</div>
                <div className="truncate text-sm">
                  {row.components.length > 0 ? row.components.join(", ") : "—"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatDateTime(tab === "trash" ? row.deleted_at : row.updated_at)}
                </div>
                <div className="flex justify-end">
                  <EntityRowActions
                    row={row}
                    tab={tab}
                    busy={busyId === row.id}
                    onDelete={handleDelete}
                    onRestore={handleRestore}
                  />
                </div>
              </div>
            ))}

            <ListPagination
              total={total}
              pageSize={PAGE_SIZE}
              currentPage={currentPage}
              loading={loading}
              onPageChange={onPageChange}
            />
          </div>
        )}
      </div>

      <EntityDetailDialog
        open={detailId != null}
        entityId={detailId}
        includeDeleted={tab === "trash"}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}
