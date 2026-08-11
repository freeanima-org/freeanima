import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Button,
  Card,
  CardContent,
  Input,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@freeanima/ui-kit";
import { FormField, FormFieldset } from "@freeanima/ui-kit/form/FormFieldset.tsx";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import type { PassiveRecallDebugTrace } from "@freeanima/shared/rpc-contract/frames/message";
import { passiveRecallDebug } from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { m } from "@freeanima/features/habitat/ui/habitat/lib/i18n.ts";
import { logCaughtError } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";

export const Route = createFileRoute("/_sidebar/passive-recall")({
  component: PassiveRecallDebugPage,
});

type DebugHit = { id: number; score: number; content_preview: string };

type DebugResult = {
  debug: PassiveRecallDebugTrace;
  inject_preview: string;
  enabled: boolean;
  limit: number;
  max_chars: number;
  exclude_resident: boolean;
};

function HitTable({ title, hits }: { title: string; hits: DebugHit[] }) {
  return (
    <Card className="py-0">
      <CardContent className="py-3 px-4 space-y-2">
        <p className="text-sm font-medium">
          {title} <span className="text-muted-foreground font-normal">({hits.length})</span>
        </p>
        {hits.length === 0 ? (
          <p className="text-xs text-muted-foreground">—</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">ID</TableHead>
                <TableHead className="w-24">Score</TableHead>
                <TableHead>Preview</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hits.map((hit) => (
                <TableRow key={`${title}-${hit.id}-${hit.score}`}>
                  <TableCell className="font-mono text-xs">{hit.id}</TableCell>
                  <TableCell className="font-mono text-xs">{hit.score.toFixed(4)}</TableCell>
                  <TableCell className="text-xs whitespace-pre-wrap">
                    {hit.content_preview}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function PassiveRecallDebugPage() {
  const [userText, setUserText] = useState("");
  const [limit, setLimit] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DebugResult | null>(null);

  const runDebug = async () => {
    const text = userText.trim();
    if (!text) return;
    setLoading(true);
    setError("");
    try {
      const data = (await passiveRecallDebug({
        user_text: text,
        limit,
      })) as DebugResult;
      setResult(data);
    } catch (e) {
      logCaughtError("routes/_sidebar/passive-recall", e);
      setError(
        m.habitat_common_search_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setLoading(false);
    }
  };

  const debug = result?.debug;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">{m.habitat_nav_passive_recall()}</h2>
        <p className="text-sm text-muted-foreground mt-1">{m.habitat_passive_recall_desc()}</p>
      </div>

      <FormFieldset className="gap-3">
        <FormField label={m.habitat_passive_recall_user_text()}>
          <Input
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            placeholder="e.g. what is my preferred editor?"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void runDebug();
              }
            }}
          />
        </FormField>
        <FormField label="Limit" className="max-w-40">
          <Input
            type="number"
            min={1}
            max={20}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 5)}
          />
        </FormField>
        <Button
          type="button"
          onClick={() => void runDebug()}
          isDisabled={loading || !userText.trim()}
        >
          {loading ? <Spinner className="size-4" /> : null}
          {m.habitat_passive_recall_run()}
        </Button>
      </FormFieldset>

      {error ? <StatusAlert variant="error">{error}</StatusAlert> : null}

      {result ? (
        <div className="space-y-3">
          <Card className="py-0">
            <CardContent className="py-3 px-4 text-xs space-y-1 font-mono">
              <p>enabled: {String(result.enabled)}</p>
              <p>limit: {result.limit}</p>
              <p>max_chars: {result.max_chars}</p>
              <p>exclude_resident: {String(result.exclude_resident)}</p>
              <p>query: {debug?.query || "—"}</p>
              <p>tsquery: {debug?.tsquery || "—"}</p>
              <p>
                min_score / relative / effective: {debug?.min_score} / {debug?.min_relative_score} /{" "}
                {debug?.effective_min_score}
              </p>
              <p>elapsed_ms: {debug?.elapsed_ms}</p>
              <p>skipped_reason: {debug?.skipped_reason ?? "—"}</p>
              <p>excluded_resident_ids: {(debug?.excluded_resident_ids ?? []).join(", ") || "—"}</p>
            </CardContent>
          </Card>

          <div>
            <h3 className="text-sm font-semibold mb-2">{m.habitat_passive_recall_stages()}</h3>
            <div className="space-y-3">
              <HitTable title="FTS" hits={debug?.fts ?? []} />
              <HitTable title="trgm" hits={debug?.trgm ?? []} />
              <HitTable title="merged" hits={debug?.merged ?? []} />
              <HitTable title="after_score_filter" hits={debug?.after_score_filter ?? []} />
              <HitTable title="after_resident_filter" hits={debug?.after_resident_filter ?? []} />
              <HitTable title="injected" hits={debug?.injected ?? []} />
            </div>
          </div>

          <Card className="py-0">
            <CardContent className="py-3 px-4 space-y-2">
              <p className="text-sm font-medium">{m.habitat_passive_recall_inject_preview()}</p>
              <pre className="text-xs whitespace-pre-wrap rounded-md bg-muted p-3 overflow-x-auto">
                {result.inject_preview || "—"}
              </pre>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
