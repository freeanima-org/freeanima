/** Shared po4a-friendly markdown checks for docs source and generated zh output. */

export const MAX_TABLE_COLUMNS = 6;

export type MarkdownCheckIssue = {
  file: string;
  line?: number;
  message: string;
};

export function hasFrontmatterTitle(content: string): boolean {
  if (!content.startsWith("---")) return false;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return false;
  const fm = content.slice(3, end);
  return /^title\s*:/m.test(fm);
}

export function checkMarkdownI18n(content: string, relPath: string): MarkdownCheckIssue[] {
  const issues: MarkdownCheckIssue[] = [];
  const lines = content.split("\n");

  if (!hasFrontmatterTitle(content)) {
    issues.push({ file: relPath, message: "missing frontmatter title:" });
  }

  let inFrontmatter = content.startsWith("---");
  let inFence = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const lineNo = i + 1;
    const trimmed = line.trim();

    if (inFrontmatter) {
      if (i > 0 && trimmed === "---") {
        inFrontmatter = false;
      }
      continue;
    }

    if (inFence) {
      if (trimmed.startsWith("```")) {
        inFence = false;
      }
      continue;
    }

    if (trimmed.startsWith("```")) {
      if (/^```\S/.test(trimmed) && !/^```[\w-]+$/.test(trimmed)) {
        issues.push({
          file: relPath,
          line: lineNo,
          message:
            "inline code fence (opening ``` must be on its own line with optional language tag)",
        });
      } else if (trimmed === "```" || /^```\s+$/.test(line)) {
        issues.push({
          file: relPath,
          line: lineNo,
          message: "fenced code block missing language identifier",
        });
        inFence = true;
      } else if (/^```[\w-]+$/.test(trimmed)) {
        inFence = true;
      }
      continue;
    }

    if (trimmed.includes("|") && trimmed.startsWith("|")) {
      const cols = trimmed.split("|").length - 2;
      if (cols > MAX_TABLE_COLUMNS) {
        issues.push({
          file: relPath,
          line: lineNo,
          message: `table row has ${cols} columns (max ${MAX_TABLE_COLUMNS}); split table or use a list`,
        });
      }
    }
  }

  if (inFence) {
    issues.push({
      file: relPath,
      message: "unclosed fenced code block",
    });
  }

  return issues;
}
