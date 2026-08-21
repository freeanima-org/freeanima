import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Input,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@freeanima/ui-kit";
import { FormField, FormFieldset } from "@freeanima/ui-kit/form/FormFieldset.tsx";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import type { PassiveRecallDebugTrace } from "@freeanima/shared/rpc-contract/frames/message";
import { passiveRecallDebug } from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { logCaughtError } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";

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
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="py-0">
      <Collapsible isExpanded={expanded} onExpandedChange={setExpanded}>
        <CardContent className="px-4 py-0">
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 py-3 text-left">
            <span className="text-sm font-medium">
              {title} <span className="text-muted-foreground font-normal">({hits.length})</span>
            </span>
            <ChevronDownIcon
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                expanded && "rotate-180",
              )}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pb-3">
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
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
}

/** 被动召回调试面板（语义记忆页 Sheet 内嵌） */
export function PassiveRecallDebugPanel() {
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
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- RPC/加载器响应边界
      const data = (await passiveRecallDebug({
        user_text: text,
        limit,
      })) as DebugResult;
      setResult(data);
    } catch (e) {
      logCaughtError("components/habitat/PassiveRecallDebugPanel", e);
      setError(`检索失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const debug = result?.debug;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {"模拟一条用户消息，查看被动语义注入各阶段（不改动对话）。"}
      </p>

      <FormFieldset className="gap-3">
        <FormField label={"模拟用户消息"}>
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
          {"运行调试"}
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
              <p>content_query: {debug?.content_query || "—"}</p>
              <p>tsquery: {debug?.tsquery || "—"}</p>
              <p>jieba_loaded: {debug?.jieba_loaded == null ? "—" : String(debug.jieba_loaded)}</p>
              <p>use_vector: {debug?.use_vector == null ? "—" : String(debug.use_vector)}</p>
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
            <h3 className="text-sm font-semibold mb-2">{"流水线阶段"}</h3>
            <div key={`${debug?.query ?? ""}-${debug?.elapsed_ms ?? 0}`} className="space-y-3">
              <HitTable title="FTS" hits={debug?.fts ?? []} />
              <HitTable title="trgm" hits={debug?.trgm ?? []} />
              <HitTable title="vector" hits={debug?.vector ?? []} />
              <HitTable title="merged" hits={debug?.merged ?? []} />
              <HitTable title="after_score_filter" hits={debug?.after_score_filter ?? []} />
              <HitTable title="after_resident_filter" hits={debug?.after_resident_filter ?? []} />
              <HitTable title="injected" hits={debug?.injected ?? []} />
            </div>
          </div>

          <Card className="py-0">
            <CardContent className="py-3 px-4 space-y-2">
              <p className="text-sm font-medium">{"注入预览"}</p>
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
