import { useState } from "react";
import { Input } from "@freeanima/ui-kit";

export type McpToolListItem = {
  original_name?: string;
  registered_name?: string;
  description?: string;
  input_schema?: Record<string, unknown>;
  name?: string;
};

function toolName(t: McpToolListItem): string {
  return t.original_name || t.name || t.registered_name || "?";
}

type Props = {
  tools: McpToolListItem[];
};

/** MCP 服务器工具列表：默认折叠、可筛选、限高滚动，避免长列表平铺 */
export function McpServerToolsList({ tools }: Props) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const filtered = !q
    ? tools
    : tools.filter((t) => {
        const hay = [toolName(t), t.registered_name, t.description]
          .filter(Boolean)
          .join("\n")
          .toLowerCase();
        return hay.includes(q);
      });

  if (tools.length === 0) {
    return <p className="text-sm text-muted-foreground">{`工具 (0)`}</p>;
  }

  return (
    <details className="group">
      <summary className="text-sm font-medium cursor-pointer select-none list-none flex items-center gap-2 [&::-webkit-details-marker]:hidden">
        <span className="text-muted-foreground group-open:rotate-90 transition-transform inline-block">
          ▸
        </span>
        {`工具 (${String(tools.length)})`}
      </summary>
      <div className="mt-2 space-y-2">
        {tools.length > 8 ? (
          <Input
            className="w-full h-8 text-xs"
            value={query}
            placeholder={"关键词…"}
            onChange={(e) => setQuery(e.target.value)}
          />
        ) : null}
        {q && filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground">{"无匹配记录。"}</p>
        ) : (
          <ul className="max-h-72 overflow-y-auto rounded-md border border-border divide-y divide-border bg-background/40">
            {filtered.map((t, i) => {
              const name = toolName(t);
              return (
                <li key={`${t.registered_name ?? name}-${i}`}>
                  <details className="px-2.5 py-1.5">
                    <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
                        <span className="font-mono text-xs font-medium shrink-0">{name}</span>
                        {t.description ? (
                          <span className="text-[11px] text-muted-foreground truncate min-w-0">
                            {t.description}
                          </span>
                        ) : null}
                      </div>
                    </summary>
                    <div className="mt-1.5 space-y-1 pl-0.5">
                      {t.description ? (
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                          {t.description}
                        </p>
                      ) : null}
                      {t.registered_name ? (
                        <p className="text-[10px] font-mono text-muted-foreground break-all">
                          {t.registered_name}
                        </p>
                      ) : null}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}
