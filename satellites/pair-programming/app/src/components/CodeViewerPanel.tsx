import { useEffect, useMemo, useRef } from "react";
import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import javascript from "highlight.js/lib/languages/javascript";
import python from "highlight.js/lib/languages/python";
import json from "highlight.js/lib/languages/json";
import yaml from "highlight.js/lib/languages/yaml";
import markdown from "highlight.js/lib/languages/markdown";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import java from "highlight.js/lib/languages/java";
import sql from "highlight.js/lib/languages/sql";
import ini from "highlight.js/lib/languages/ini";
import "highlight.js/styles/github-dark.css";
import { m } from "@pair/lib/i18n.ts";
import type { StudioFileView } from "@pair/stores/pair-programming.ts";

hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("json", json);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("vue", xml);
hljs.registerLanguage("go", go);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("java", java);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("ini", ini);
hljs.registerLanguage("dockerfile", bash);

type CodeViewerPanelProps = {
  file: StudioFileView | null;
};

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatSize(n: number) {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

export function CodeViewerPanel({ file }: CodeViewerPanelProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => {
    if (!file?.content) return [] as string[];
    return String(file.content).split("\n");
  }, [file?.content]);

  const highlightLine = file?.highlightLine ?? null;
  const lang = String(file?.language || "plaintext");

  const highlightedLines = useMemo(() => {
    const registered = hljs.getLanguage(lang);
    return lines.map((line) => {
      if (!registered) return escapeHtml(line);
      try {
        return hljs.highlight(line, { language: lang }).value;
      } catch {
        return escapeHtml(line);
      }
    });
  }, [lang, lines]);

  useEffect(() => {
    if (!highlightLine || !scrollAreaRef.current) return;
    const el = scrollAreaRef.current.querySelector(`[data-line="${highlightLine}"]`);
    el?.scrollIntoView({ block: "center" });
  }, [file?.path, highlightLine]);

  if (!file) {
    return (
      <div className="h-full flex flex-col min-h-0 bg-base-100">
        <div className="flex-1 flex items-center justify-center text-base-content/40 text-sm">
          {m.pair_codeviewer_select_file()}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 bg-base-100">
      <div className="px-3 py-1.5 border-b border-base-300 text-xs font-mono truncate shrink-0 bg-base-200/50">
        {String(file.path)}
        <span className="text-base-content/50 ml-2">
          {lang} · {formatSize(Number(file.size ?? 0))}
        </span>
      </div>
      <div ref={scrollAreaRef} className="flex-1 overflow-auto min-h-0">
        <table className="code-viewer-table w-full border-collapse font-mono text-[13px] leading-normal">
          <tbody>
            {lines.map((_line, i) => (
              <tr
                key={i}
                data-line={i + 1}
                className={highlightLine === i + 1 ? "code-line-highlight" : undefined}
              >
                <td className="code-ln w-12 px-3 text-right text-base-content/35 select-none align-top border-r border-base-300 bg-base-200/50">
                  {i + 1}
                </td>
                <td className="code-content px-4 whitespace-pre align-top">
                  <pre
                    className="m-0 inline"
                    dangerouslySetInnerHTML={{ __html: highlightedLines[i] ?? "" }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style>{`
        .code-line-highlight .code-ln,
        .code-line-highlight .code-content {
          background: oklch(var(--p) / 0.15);
        }
      `}</style>
    </div>
  );
}
