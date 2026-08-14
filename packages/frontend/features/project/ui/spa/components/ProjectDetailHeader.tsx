import type { ProjectRow } from "../lib/api.ts";

type ProjectDetailHeaderProps = {
  project: ProjectRow;
};

function formatDateShort(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
}

/** 顶栏只读日程摘要：无 label；无日期时不渲染 */
export function ProjectDetailHeader({ project }: ProjectDetailHeaderProps) {
  const start = formatDateShort(project.start_at);
  const end = formatDateShort(project.end_at);
  if (!start && !end) return null;

  let text: string;
  if (start && end) text = `${start} – ${end}`;
  else if (start) text = `自 ${start}`;
  else text = `至 ${end}`;

  return (
    <p className="text-muted-foreground truncate text-[11px] leading-4" title={text}>
      {text}
    </p>
  );
}
