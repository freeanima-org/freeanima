import type { ShellModuleId } from "@freeanima/client/portal-sdk/shell-module-visibility";
import { usePomodoroNavCountdown } from "@freeanima/client/portal-sdk/use-pomodoro-nav-countdown.ts";
import { cn } from "@freeanima/ui-kit";

/** Rail 收起：图标下等宽时钟 */
export function AppNavPomodoroCollapsedClock({ moduleId }: { moduleId: ShellModuleId }) {
  const { clock } = usePomodoroNavCountdown();
  if (moduleId !== "pomodoro" || !clock) return null;
  return (
    <span className="app-rail-nav-pomodoro-clock text-muted-foreground tabular-nums" aria-hidden>
      {clock}
    </span>
  );
}

/** Rail 展开 / 底栏 / 更多菜单：有会话时替换模块名 */
export function useAppNavPomodoroDisplayLabel(
  moduleId: ShellModuleId,
  fallback: string,
  mode: "expanded" | "compact",
): { label: string; ariaLabel: string; hasActive: boolean } {
  const { clock, navLabel } = usePomodoroNavCountdown();
  if (moduleId !== "pomodoro" || !clock || !navLabel) {
    return { label: fallback, ariaLabel: fallback, hasActive: false };
  }
  if (mode === "compact") {
    return { label: clock, ariaLabel: navLabel, hasActive: true };
  }
  return { label: navLabel, ariaLabel: navLabel, hasActive: true };
}

export function AppNavPomodoroMoreLabel({
  moduleId,
  fallback,
}: {
  moduleId: ShellModuleId;
  fallback: string;
}) {
  const { label } = useAppNavPomodoroDisplayLabel(moduleId, fallback, "expanded");
  return (
    <span className={cn(moduleId === "pomodoro" && label !== fallback && "tabular-nums")}>
      {label}
    </span>
  );
}
