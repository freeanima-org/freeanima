import { omitUndefined } from "../../lib/omit-undefined.ts";
import { createFileRoute } from "@tanstack/react-router";
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
} from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { formatDisplayDateTime } from "@freeanima/features/habitat/ui/habitat/lib/format-datetime.ts";
import { m } from "@freeanima/features/habitat/ui/habitat/lib/i18n.ts";
import { logCaughtError } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";
import { useHabitatOffsetPagination } from "@freeanima/features/habitat/ui/habitat/lib/use-habitat-offset-pagination.ts";

const PAGE_SIZE = 20;
const ENTITY_TABS = ["day", "month", "year"] as const;
type EntityWindow = (typeof ENTITY_TABS)[number];
type PageTab = EntityWindow | "system_rolls";
type ToolbarOp = "list" | "backfill" | "regen";

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
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<TemporalRow[]>([]);
  const [rolls, setRolls] = useState<SystemRollRow[]>([]);
  const [regenKey, setRegenKey] = useState<string | null>(null);
  /** 互斥：查询 / 补跑 / 单行重生成同时只允许一个；避免第二个操作清掉第一个的 loading */
  const opRef = useRef<ToolbarOp | null>(null);
  const toolbarBusy = listLoading || backfilling || regenKey != null;

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
        setError(
          m.habitat_common_load_failed({
            detail: e instanceof Error ? e.message : String(e),
          }),
        );
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
      setError(
        m.habitat_common_load_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
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
        setError(result.summary || m.habitat_temporal_summary_regen_failed());
        return;
      }
      await fetchEntityList(row.window, offsetForPage(currentPage), { silent: true });
    } catch (e) {
      logCaughtError("routes/_sidebar/temporal-summary/regen", e);
      setError(
        m.habitat_common_load_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setRegenKey(null);
      if (opRef.current === "regen") opRef.current = null;
    }
  };

  const onBackfillMissing = async (window: EntityWindow) => {
    const period_start_from = from.trim();
    const period_start_to = to.trim();
    if (!period_start_from || !period_start_to) {
      setError(m.habitat_temporal_summary_backfill_need_range());
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
        m.habitat_temporal_summary_backfill_done({
          missing: String(result.missing?.length ?? 0),
          filled: String(result.filled?.length ?? 0),
          failed: String(result.failed?.length ?? 0),
        }),
      );
      await fetchEntityList(window, 0, { silent: true });
    } catch (e) {
      logCaughtError("routes/_sidebar/temporal-summary/backfill", e);
      setError(
        m.habitat_common_load_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setBackfilling(false);
      if (opRef.current === "backfill") opRef.current = null;
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
      setError(
        m.habitat_common_load_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
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
        m.habitat_temporal_summary_backfill_done({
          missing: String(missing.length),
          filled: String(filled),
          failed: String(failed),
        }),
      );
      await fetchRolls({ silent: true });
    } catch (e) {
      logCaughtError("routes/_sidebar/temporal-summary/roll-backfill", e);
      setError(
        m.habitat_common_load_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setBackfilling(false);
      if (opRef.current === "backfill") opRef.current = null;
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">{m.habitat_nav_temporal_summary()}</h2>
        <p className="text-sm text-muted-foreground mt-1">{m.habitat_temporal_summary_desc()}</p>
      </div>

      <Tabs
        selectedKey={tab}
        onSelectionChange={(key) => {
          if (key != null) setTab(String(key) as PageTab);
        }}
        className="space-y-4"
      >
        <TabsList className="w-fit flex-wrap h-auto">
          {ENTITY_TABS.map((w) => (
            <TabsTrigger key={w} id={w}>
              {w === "day"
                ? m.habitat_temporal_summary_tab_day()
                : w === "month"
                  ? m.habitat_temporal_summary_tab_month()
                  : m.habitat_temporal_summary_tab_year()}
            </TabsTrigger>
          ))}
          <TabsTrigger id="system_rolls">
            {m.habitat_temporal_summary_tab_system_rolls()}
          </TabsTrigger>
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
                    {m.habitat_common_search()}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void onBackfillMissing(w)}
                    isDisabled={toolbarBusy}
                  >
                    {backfilling ? <Spinner className="size-4" /> : null}
                    {m.habitat_temporal_summary_backfill_missing()}
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
                  <TableHead className="w-20">
                    {m.habitat_temporal_summary_content_chars()}
                  </TableHead>
                  <TableHead className="w-20">{m.habitat_temporal_summary_sources()}</TableHead>
                  <TableHead className="w-28">
                    {m.habitat_temporal_summary_empty_reason()}
                  </TableHead>
                  <TableHead>content</TableHead>
                  <TableHead className="w-40">updated</TableHead>
                  <TableHead className="w-28">{m.habitat_temporal_summary_actions()}</TableHead>
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
                            {m.habitat_temporal_summary_regenerate()}
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
            {m.habitat_temporal_summary_system_rolls_desc()}
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
              {m.habitat_common_search()}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void onBackfillMissingRolls()}
              isDisabled={toolbarBusy}
            >
              {backfilling ? <Spinner className="size-4" /> : null}
              {m.habitat_temporal_summary_backfill_missing()}
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">{m.habitat_temporal_summary_roll_kind()}</TableHead>
                <TableHead className="w-28">anchor</TableHead>
                <TableHead className="w-24">{m.habitat_temporal_summary_cache()}</TableHead>
                <TableHead className="w-20">sources</TableHead>
                <TableHead>summary</TableHead>
                <TableHead className="w-40">created</TableHead>
                <TableHead className="w-28">{m.habitat_temporal_summary_actions()}</TableHead>
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
                    <TableCell className="text-xs">
                      {row.cache_hit
                        ? m.habitat_temporal_summary_cache_hit()
                        : m.habitat_temporal_summary_cache_miss()}
                    </TableCell>
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
                        {m.habitat_temporal_summary_regenerate()}
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
