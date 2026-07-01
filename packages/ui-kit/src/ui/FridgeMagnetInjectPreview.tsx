import { Badge } from "../components/ui/badge.tsx";
import { Button } from "../components/ui/button.tsx";
import { Spinner } from "../components/ui/spinner.tsx";

export type FridgeMagnetInjectPreviewLabels = {
  title: string;
  refresh: string;
  redisUnavailable: string;
  noNotes: string;
};

type FridgeMagnetInjectPreviewProps = FridgeMagnetInjectPreviewLabels & {
  injectText: string;
  magnetCount: number;
  redisConfigured: boolean;
  loading?: boolean;
  onRefresh?: () => void;
};

export function FridgeMagnetInjectPreview({
  title,
  refresh,
  redisUnavailable,
  noNotes,
  injectText,
  magnetCount,
  redisConfigured,
  loading = false,
  onRefresh,
}: FridgeMagnetInjectPreviewProps) {
  const hasMagnets = magnetCount > 0;

  return (
    <details className="group border-t bg-background">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:bg-muted">
        <span className="group-open:rotate-90 transition-transform">▶</span>
        <span>{title}</span>
        {hasMagnets ? (
          <Badge variant="ghost" className="text-xs">
            {magnetCount}
          </Badge>
        ) : null}
        {onRefresh ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-auto px-2 py-1 text-xs"
            disabled={loading}
            onClick={(e) => {
              e.preventDefault();
              onRefresh();
            }}
          >
            {loading ? <Spinner className="size-3" /> : refresh}
          </Button>
        ) : null}
      </summary>
      <div className="px-4 pb-3">
        {!redisConfigured ? (
          <p className="text-xs text-yellow-700 dark:text-yellow-300">{redisUnavailable}</p>
        ) : !hasMagnets ? (
          <p className="text-xs text-muted-foreground">{noNotes}</p>
        ) : (
          <pre className="font-mono text-xs whitespace-pre-wrap text-muted-foreground bg-muted rounded-lg p-2 overflow-x-auto">
            {injectText.trimEnd()}
          </pre>
        )}
      </div>
    </details>
  );
}
