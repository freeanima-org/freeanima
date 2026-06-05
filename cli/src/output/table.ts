const COL_MAX = [45, 14, 48, 40] as const;
const COL_MIN = 6;

/** 简单文本表格（列宽截断） */
export function renderTable(rows: string[][], headers: string[]): string {
  const colCount = headers.length;
  const widths: number[] = Array.from({ length: colCount }, (_, i) =>
    Math.min(COL_MAX[i] ?? 30, COL_MAX[i] ?? 30),
  );

  for (const row of rows) {
    for (let i = 0; i < colCount; i++) {
      const cell = row[i] ?? "";
      const cmax = COL_MAX[i] ?? 30;
      widths[i] = Math.max(widths[i]!, Math.min(cell.length, cmax), COL_MIN);
    }
  }

  for (let i = 0; i < colCount; i++) {
    const cmax = COL_MAX[i] ?? 30;
    widths[i] = Math.max(Math.min(widths[i]!, cmax), COL_MIN);
  }

  const cell = (text: string, i: number): string => {
    const w = widths[i]!;
    const clipped = text.length > w ? `${text.slice(0, w - 1)}…` : text;
    return i > 0 ? clipped.padEnd(w) : clipped.padEnd(w);
  };

  const sep = "  ";
  const lines = [
    sep + headers.map((h, i) => cell(h, i)).join(sep),
    sep + widths.map((w) => "─".repeat(w)).join(sep),
    ...rows.map((row) => sep + row.map((c, i) => cell(c, i)).join(sep)),
  ];
  return lines.join("\n");
}
