import { Button } from "@freeanima/ui-kit";

export type SlashCommandResultPanelProps = {
  command: string;
  text: string;
  loading?: boolean;
  onClose: () => void;
  renderMd: (text: string) => string;
};

export function SlashCommandResultPanel({
  command,
  text,
  loading = false,
  onClose,
  renderMd,
}: SlashCommandResultPanelProps) {
  return (
    <div
      className="rounded-lg border border-primary/30 bg-muted/80 px-3 py-2 text-sm shadow-sm"
      data-testid="slash-command-result-panel"
    >
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="font-semibold">{"命令结果"}</span>
        <span className="font-mono text-xs text-muted-foreground">/{command}</span>
        <div className="ml-auto">
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={onClose}>
            {"关闭"}
          </Button>
        </div>
      </div>
      {loading && !text.trim() ? (
        <p className="text-xs text-muted-foreground">{"运行中…"}</p>
      ) : (
        <div
          className="prose prose-sm dark:prose-invert max-h-60 max-w-none overflow-y-auto"
          dangerouslySetInnerHTML={{ __html: renderMd(text) }}
        />
      )}
    </div>
  );
}
