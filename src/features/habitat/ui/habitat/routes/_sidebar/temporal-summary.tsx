import { omitUndefined } from "../../lib/omit-undefined.ts";
import { createFileRoute } from "@tanstack/react-router";
import type { Key } from "react-aria-components";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@freeanima/ui-kit";
import { DatePickerInput } from "@freeanima/ui-kit/form/DatePickerInput.tsx";
import { FormField, FormFieldset } from "@freeanima/ui-kit/form/FormFieldset.tsx";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { MemoryListPagination } from "@freeanima/features/habitat/ui/habitat/components/habitat/MemoryListPagination.tsx";
import {
  backfillMissingTemporalSummaries,
  listTemporalSummaries,
  listTemporalSystemRolls,
  regenerateTemporalSummary,
  regenerateTemporalSystemRoll,
  rebuildTemporalSummariesInRange,
} from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { formatDisplayDateTime } from "@freeanima/features/habitat/ui/habitat/lib/format-datetime.ts";
import { logCaughtError } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";
import { useHabitatOffsetPagination } from "@freeanima/features/habitat/ui/habitat/lib/use-habitat-offset-pagination.ts";

const PAGE_SIZE = 20;
const ENTITY_TABS = ["day", "month", "year"] as const;
type EntityWindow = (typeof ENTITY_TABS)[number];
type PageTab = EntityWindow | "system_rolls";
type ToolbarOp = "list" | "backfill" | "rebuild" | "regen";

type TemporalRow = {
  id: number;
  window: EntityWindow;
  period_start: string;
  content: string;
  content_chars: number;
  empty_reason: string | null;
  source_count: number | null;
  updated_at: string;
};

type SystemRollRow = {
  kind: "past_days" | "past_months" | "past_years";
  anchor: string;
  label: string;
  cache_hit: boolean;
  summary: string;
  sources_fp: string | null;
  created_at: string | null;
  source_count: number;
  redis_key: string;
};

export const Route = createFileRoute("/_sidebar/temporal-summary")({
  component: TemporalSummaryPage,
});

function TemporalSummaryPage() {
  const [tab, setTab] = useState<PageTab>("day");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { setOffset, currentPage, offsetForPage } = useHabitatOffsetPagination(PAGE_SIZE);
  const [listLoading, setListLoading] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<TemporalRow[]>([]);
  const [rolls, setRolls] = useState<SystemRollRow[]>([]);
  const [regenKey, setRegenKey] = useState<string | null>(null);
  /** 互斥：查询 / 补跑 / 强制重跑 / 单行重生成同时只允许一个；避免第二个操作清掉第一个的 loading */
  const opRef = useRef<ToolbarOp | null>(null);
  const toolbarBusy = listLoading || backfilling || rebuilding || regenKey != null;

  const fetchEntityList = useCallback(
    async (
      window: EntityWindow,
      nextOffset: number,
      opts?: { silent?: boolean; claimOp?: boolean },
    ) => {
      const silent = opts?.silent === true;
      const claimOp = opts?.claimOp !== false && !silent;
      if (claimOp) {
        if (opRef.current) return;
        opRef.current = "list";
        setListLoading(true);
      }
      if (!silent) setError("");
      try {
        const data = (await listTemporalSummaries(
          omitUndefined({
            window,
            period_start_from: from.trim() || undefined,
            period_start_to: to.trim() || undefined,
            offset: nextOffset,
            limit: PAGE_SIZE,
          }),
        )) as { items: TemporalRow[]; total: number };
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setOffset(nextOffset);
      } catch (e) {
        logCaughtError("routes/_sidebar/temporal-summary", e);
        setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        if (claimOp) {
          setListLoading(false);
          if (opRef.current === "list") opRef.current = null;
        }
      }
    },
    [from, setOffset, to],
  );

  const fetchRolls = useCallback(async (opts?: { silent?: boolean; claimOp?: boolean }) => {
    const silent = opts?.silent === true;
    const claimOp = opts?.claimOp !== false && !silent;
    if (claimOp) {
      if (opRef.current) return;
      opRef.current = "list";
      setListLoading(true);
    }
    if (!silent) setError("");
    try {
      const data = (await listTemporalSystemRolls()) as { items: SystemRollRow[] };
      setRolls(data.items ?? []);
    } catch (e) {
      logCaughtError("routes/_sidebar/temporal-summary/system-rolls", e);
      setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      if (claimOp) {
        setListLoading(false);
        if (opRef.current === "list") opRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (tab === "system_rolls") {
      void fetchRolls();
      return;
    }
    void fetchEntityList(tab, 0);
  }, [tab, fetchEntityList, fetchRolls]);

  const onRegenerateEntity = async (row: TemporalRow) => {
    if (opRef.current) return;
    const key = `${row.window}:${row.period_start}`;
    opRef.current = "regen";
    setRegenKey(key);
    setError("");
    setInfo("");
    try {
      const result = (await regenerateTemporalSummary({
        window: row.window,
        period_start: row.period_start,
      })) as { ok?: boolean; summary?: string };
      if (result.ok === false) {
        setError(result.summary || "重新生成失败");
        return;
      }
      await fetchEntityList(row.window, offsetForPage(currentPage), { silent: true });
    } catch (e) {
      logCaughtError("routes/_sidebar/temporal-summary/regen", e);
      setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRegenKey(null);
      if (opRef.current === "regen") opRef.current = null;
    }
  };

  const onBackfillMissing = async (window: EntityWindow) => {
    const period_start_from = from.trim();
    const period_start_to = to.trim();
    if (!period_start_from || !period_start_to) {
      setError("补全缺失周期前请同时设置起止日期（YYYY-MM-DD）。");
      return;
    }
    if (opRef.current) return;
    opRef.current = "backfill";
    setBackfilling(true);
    setError("");
    setInfo("");
    try {
      const result = (await backfillMissingTemporalSummaries({
        window,
        period_start_from,
        period_start_to,
      })) as {
        missing?: string[];
        filled?: string[];
        failed?: unknown[];
        summary?: string;
      };
      setInfo(
        `补全完成：缺失 ${String(result.missing?.length ?? 0)}，已填 ${String(result.filled?.length ?? 0)}，失败 ${String(result.failed?.length ?? 0)}`,
      );
      await fetchEntityList(window, 0, { silent: true });
    } catch (e) {
      logCaughtError("routes/_sidebar/temporal-summary/backfill", e);
      setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBackfilling(false);
      if (opRef.current === "backfill") opRef.current = null;
    }
  };

  const onRebuildRange = async (window: EntityWindow) => {
    const period_start_from = from.trim();
    const period_start_to = to.trim();
    if (!period_start_from || !period_start_to) {
      setError("强制重跑前请同时设置起止日期（YYYY-MM-DD）。");
      return;
    }
    if (opRef.current) return;
    opRef.current = "rebuild";
    setRebuilding(true);
    setError("");
    setInfo("");
    try {
      const result = (await rebuildTemporalSummariesInRange({
        window,
        period_start_from,
        period_start_to,
      })) as {
        expected?: string[];
        filled?: string[];
        failed?: unknown[];
        summary?: string;
      };
      setInfo(
        `强制重跑完成：期望 ${String(result.expected?.length ?? 0)}，已填 ${String(result.filled?.length ?? 0)}，失败 ${String(result.failed?.length ?? 0)}`,
      );
      await fetchEntityList(window, 0, { silent: true });
    } catch (e) {
      logCaughtError("routes/_sidebar/temporal-summary/rebuild", e);
      setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRebuilding(false);
      if (opRef.current === "rebuild") opRef.current = null;
    }
  };

  const onRegenerateRoll = async (kind: SystemRollRow["kind"]) => {
    if (opRef.current) return;
    opRef.current = "regen";
    setRegenKey(kind);
    setError("");
    setInfo("");
    try {
      await regenerateTemporalSystemRoll({ kind });
      await fetchRolls({ silent: true });
    } catch (e) {
      logCaughtError("routes/_sidebar/temporal-summary/roll-regen", e);
      setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRegenKey(null);
      if (opRef.current === "regen") opRef.current = null;
    }
  };

  const onBackfillMissingRolls = async () => {
    if (opRef.current) return;
    opRef.current = "backfill";
    setBackfilling(true);
    setError("");
    setInfo("");
    try {
      const missing = rolls.filter((r) => !r.cache_hit || !r.summary.trim());
      let filled = 0;
      let failed = 0;
      for (const row of missing) {
        try {
          await regenerateTemporalSystemRoll({ kind: row.kind });
          filled += 1;
        } catch {
          failed += 1;
        }
      }
      setInfo(
        `补全完成：缺失 ${String(missing.length)}，已填 ${String(filled)}，失败 ${String(failed)}`,
      );
      await fetchRolls({ silent: true });
    } catch (e) {
      logCaughtError("routes/_sidebar/temporal-summary/roll-backfill", e);
      setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBackfilling(false);
      if (opRef.current === "backfill") opRef.current = null;
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">{"⏳ 时间摘要"}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {
            "全局日/月/年实体（各周期结束后写入），以及三条反向系统汇总（过往日/月/年），经 Redis 缓存。计入所有非 debug、非 cron 会话（含 remote）；全局日按消息时间选源。「补全缺失」只填没有行的周期；「强制重跑」覆盖区间内全部期望周期（含空占位）。"
          }
        </p>
      </div>

      <Tabs
        selectedKey={tab}
        onSelectionChange={(key: Key) => {
          if (key != null) setTab(String(key) as PageTab);
        }}
        className="space-y-4"
      >
        <TabsList className="w-fit flex-wrap h-auto">
          {ENTITY_TABS.map((w) => (
            <TabsTrigger key={w} id={w}>
              {w === "day" ? "日" : w === "month" ? "月" : "年"}
            </TabsTrigger>
          ))}
          <TabsTrigger id="system_rolls">{"系统汇总"}</TabsTrigger>
        </TabsList>

        {ENTITY_TABS.map((w) => (
          <TabsContent key={w} id={w} className="space-y-4">
            <FormFieldset className="space-y-0">
              <div className="flex flex-wrap items-end gap-3">
                <FormField label="From" className="min-w-40">
                  <DatePickerInput value={from} aria-label="From" onChange={setFrom} />
                </FormField>
                <FormField label="To" className="min-w-40">
                  <DatePickerInput value={to} aria-label="To" onChange={setTo} />
                </FormField>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => void fetchEntityList(w, 0)}
                    isDisabled={toolbarBusy}
                  >
                    {listLoading ? <Spinner className="size-4" /> : null}
                    {"查询"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void onBackfillMissing(w)}
                    isDisabled={toolbarBusy}
                  >
                    {backfilling ? <Spinner className="size-4" /> : null}
                    {"补全缺失"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void onRebuildRange(w)}
                    isDisabled={toolbarBusy}
                  >
                    {rebuilding ? <Spinner className="size-4" /> : null}
                    {"强制重跑"}
                  </Button>
                </div>
              </div>
            </FormFieldset>

            {error && tab === w ? <StatusAlert variant="error">{error}</StatusAlert> : null}
            {info && tab === w ? <StatusAlert variant="info">{info}</StatusAlert> : null}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">ID</TableHead>
                  <TableHead className="w-32">period_start</TableHead>
                  <TableHead className="w-20">{"字符数"}</TableHead>
                  <TableHead className="w-20">{"来源"}</TableHead>
                  <TableHead className="w-28">{"为空原因"}</TableHead>
                  <TableHead>content</TableHead>
                  <TableHead className="w-40">updated</TableHead>
                  <TableHead className="w-28">{"操作"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground text-sm">
                      —
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((row) => {
                    const key = `${row.window}:${row.period_start}`;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-xs">{row.id}</TableCell>
                        <TableCell className="font-mono text-xs">{row.period_start}</TableCell>
                        <TableCell className="font-mono text-xs">{row.content_chars}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.source_count ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {row.empty_reason ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs whitespace-pre-wrap max-w-xl">
                          {row.content || "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatDisplayDateTime(row.updated_at)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            isDisabled={toolbarBusy}
                            onClick={() => void onRegenerateEntity(row)}
                          >
                            {regenKey === key ? <Spinner className="size-3" /> : null}
                            {"重新生成"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            <MemoryListPagination
              currentPage={currentPage}
              total={total}
              pageSize={PAGE_SIZE}
              loading={toolbarBusy}
              onPageChange={(page) => void fetchEntityList(w, offsetForPage(page))}
            />
          </TabsContent>
        ))}

        <TabsContent id="system_rolls" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {
              "提示词注入汇总：过往日（本月今天之前）、过往月（本年本月之前）、过往年（本年之前）。每条 ≤100 字（硬上限 1.5×）；仅在 Redis 有对应缓存时列出。"
            }
          </p>
          {error && tab === "system_rolls" ? (
            <StatusAlert variant="error">{error}</StatusAlert>
          ) : null}
          {info && tab === "system_rolls" ? <StatusAlert variant="info">{info}</StatusAlert> : null}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void fetchRolls()}
              isDisabled={toolbarBusy}
            >
              {listLoading ? <Spinner className="size-4" /> : null}
              {"查询"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void onBackfillMissingRolls()}
              isDisabled={toolbarBusy}
            >
              {backfilling ? <Spinner className="size-4" /> : null}
              {"补全缺失"}
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">{"汇总类型"}</TableHead>
                <TableHead className="w-28">anchor</TableHead>
                <TableHead className="w-24">{"缓存"}</TableHead>
                <TableHead className="w-20">sources</TableHead>
                <TableHead>summary</TableHead>
                <TableHead className="w-40">created</TableHead>
                <TableHead className="w-28">{"操作"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rolls.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground text-sm">
                    —
                  </TableCell>
                </TableRow>
              ) : (
                rolls.map((row) => (
                  <TableRow key={row.kind}>
                    <TableCell className="text-xs">{row.label}</TableCell>
                    <TableCell className="font-mono text-xs">{row.anchor}</TableCell>
                    <TableCell className="text-xs">{row.cache_hit ? "命中" : "未命中"}</TableCell>
                    <TableCell className="font-mono text-xs">{row.source_count}</TableCell>
                    <TableCell className="text-xs whitespace-pre-wrap max-w-xl">
                      {row.summary || "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.created_at ? formatDisplayDateTime(row.created_at) : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        isDisabled={toolbarBusy}
                        onClick={() => void onRegenerateRoll(row.kind)}
                      >
                        {regenKey === row.kind ? <Spinner className="size-3" /> : null}
                        {"重新生成"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}
