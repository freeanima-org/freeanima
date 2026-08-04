import { omitUndefined } from "../../lib/omit-undefined.ts";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Input,
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
import { FormField, FormFieldset } from "@freeanima/ui-kit/form/FormFieldset.tsx";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { MemoryListPagination } from "@freeanima/features/habitat/ui/habitat/components/habitat/MemoryListPagination.tsx";
import {
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

type TemporalRow = {
  id: number;
  window: EntityWindow;
  period_start: string;
  content: string;
  content_chars: number;
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<TemporalRow[]>([]);
  const [rolls, setRolls] = useState<SystemRollRow[]>([]);
  const [regenKey, setRegenKey] = useState<string | null>(null);

  const fetchEntityList = useCallback(
    async (window: EntityWindow, nextOffset: number) => {
      setLoading(true);
      setError("");
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
        setLoading(false);
      }
    },
    [from, setOffset, to],
  );

  const fetchRolls = useCallback(async () => {
    setLoading(true);
    setError("");
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
      setLoading(false);
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
    const key = `${row.window}:${row.period_start}`;
    setRegenKey(key);
    setError("");
    try {
      const result = (await regenerateTemporalSummary({
        window: row.window,
        period_start: row.period_start,
      })) as { ok?: boolean; summary?: string };
      if (result.ok === false) {
        setError(result.summary || m.habitat_temporal_summary_regen_failed());
        return;
      }
      await fetchEntityList(row.window, offsetForPage(currentPage));
    } catch (e) {
      logCaughtError("routes/_sidebar/temporal-summary/regen", e);
      setError(
        m.habitat_common_load_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setRegenKey(null);
    }
  };

  const onRegenerateRoll = async (kind: SystemRollRow["kind"]) => {
    setRegenKey(kind);
    setError("");
    try {
      await regenerateTemporalSystemRoll({ kind });
      await fetchRolls();
    } catch (e) {
      logCaughtError("routes/_sidebar/temporal-summary/roll-regen", e);
      setError(
        m.habitat_common_load_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setRegenKey(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">{m.habitat_nav_temporal_summary()}</h2>
        <p className="text-sm text-muted-foreground mt-1">{m.habitat_temporal_summary_desc()}</p>
      </div>

      <Tabs value={tab} onValueChange={(v: string) => setTab(v as PageTab)} className="space-y-4">
        <TabsList className="w-fit flex-wrap h-auto">
          {ENTITY_TABS.map((w) => (
            <TabsTrigger key={w} value={w}>
              {w === "day"
                ? m.habitat_temporal_summary_tab_day()
                : w === "month"
                  ? m.habitat_temporal_summary_tab_month()
                  : m.habitat_temporal_summary_tab_year()}
            </TabsTrigger>
          ))}
          <TabsTrigger value="system_rolls">
            {m.habitat_temporal_summary_tab_system_rolls()}
          </TabsTrigger>
        </TabsList>

        {ENTITY_TABS.map((w) => (
          <TabsContent key={w} value={w} className="space-y-4">
            <FormFieldset className="flex flex-wrap items-end gap-3">
              <FormField label="From" className="min-w-40">
                <Input
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  placeholder="YYYY-MM-DD"
                />
              </FormField>
              <FormField label="To" className="min-w-40">
                <Input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="YYYY-MM-DD"
                />
              </FormField>
              <Button type="button" onClick={() => void fetchEntityList(w, 0)} disabled={loading}>
                {loading ? <Spinner className="size-4" /> : null}
                {m.habitat_common_search()}
              </Button>
            </FormFieldset>

            {error && tab === w ? <StatusAlert variant="error">{error}</StatusAlert> : null}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">ID</TableHead>
                  <TableHead className="w-32">period_start</TableHead>
                  <TableHead className="w-20">
                    {m.habitat_temporal_summary_content_chars()}
                  </TableHead>
                  <TableHead>content</TableHead>
                  <TableHead className="w-40">updated</TableHead>
                  <TableHead className="w-28">{m.habitat_temporal_summary_actions()}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground text-sm">
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
                        <TableCell className="text-xs whitespace-pre-wrap max-w-xl">
                          {row.content}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatDisplayDateTime(row.updated_at)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={regenKey === key || loading}
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
              loading={loading}
              onPageChange={(page) => void fetchEntityList(w, offsetForPage(page))}
            />
          </TabsContent>
        ))}

        <TabsContent value="system_rolls" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {m.habitat_temporal_summary_system_rolls_desc()}
          </p>
          {error && tab === "system_rolls" ? (
            <StatusAlert variant="error">{error}</StatusAlert>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void fetchRolls()}
              disabled={loading}
            >
              {loading ? <Spinner className="size-4" /> : null}
              {m.habitat_common_search()}
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
                        disabled={regenKey === row.kind || loading}
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
