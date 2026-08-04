import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";

import { languageFromPath } from "../lib/code-language.ts";

type Props = {
  path: string | null;
  /** 原始文件文本（无行号前缀） */
  text: string;
  loading?: boolean;
};

function splitLines(text: string): string[] {
  if (!text) return [];
  const lines = text.split("\n");
  // 保留末行空字符串时的行数语义：最后一空行不算额外展示行
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export function CodePreview({ path, text, loading }: Props) {
  const [html, setHtml] = useState<string>("");
  const [hlError, setHlError] = useState<string | null>(null);
  const lines = splitLines(text);
  const gutterWidth = Math.max(2, String(lines.length || 1).length);

  useEffect(() => {
    let cancelled = false;
    if (!path || !text) {
      setHtml("");
      setHlError(null);
      return;
    }
    const lang = languageFromPath(path);
    void (async () => {
      try {
        const out = await codeToHtml(text, {
          lang,
          theme: "github-light",
          // 失败语言回落由 shiki 抛；catch 后纯文本
        });
        if (!cancelled) {
          setHtml(out);
          setHlError(null);
        }
      } catch {
        try {
          const out = await codeToHtml(text, { lang: "plaintext", theme: "github-light" });
          if (!cancelled) {
            setHtml(out);
            setHlError(null);
          }
        } catch (e) {
          if (!cancelled) {
            setHtml("");
            setHlError(e instanceof Error ? e.message : String(e));
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path, text]);

  if (loading) {
    return <p className="muted coding-preview-empty">加载中…</p>;
  }
  if (!path) {
    return (
      <p className="muted coding-preview-empty">从左侧资源管理器打开文件，或先为会话添加工作区</p>
    );
  }
  if (!text && !hlError) {
    return <p className="muted coding-preview-empty">（空文件）</p>;
  }

  return (
    <div className="coding-code-preview" role="region" aria-label={`预览 ${path}`}>
      <div className="coding-code-scroll">
        <div
          className="coding-code-gutter"
          aria-hidden
          style={{ ["--gutter-ch" as string]: gutterWidth }}
        >
          {lines.map((_, i) => (
            <div key={i} className="coding-code-ln">
              {i + 1}
            </div>
          ))}
        </div>
        <div className="coding-code-body">
          {hlError ? (
            <pre className="coding-code-fallback">{text}</pre>
          ) : html ? (
            <div
              className="coding-code-shiki"
              // Shiki 输出为可信高亮 HTML（本地文本）
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <pre className="coding-code-fallback">{text}</pre>
          )}
        </div>
      </div>
    </div>
  );
}
