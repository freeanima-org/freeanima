export type CommandSkillReviewData = {
  action: "skill_review";
  mode: "evolve" | "maintain";
  force?: boolean;
  note?: string;
};

export function isSkillReviewResult(result: {
  data?: unknown;
}): result is { text: string; data: CommandSkillReviewData; ux?: "toast" | "panel" } {
  const d = result.data;
  return (
    !!d &&
    typeof d === "object" &&
    (d as { action?: unknown }).action === "skill_review" &&
    ((d as { mode?: unknown }).mode === "evolve" || (d as { mode?: unknown }).mode === "maintain")
  );
}
