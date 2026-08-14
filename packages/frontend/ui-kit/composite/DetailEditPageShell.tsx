import type { ReactNode } from "react";
import { ChevronLeftIcon } from "lucide-react";

import { Button } from "../components/ui/button.tsx";

export type DetailEditPageShellProps = {
  /** 顶栏标题；默认「编辑」 */
  title?: ReactNode;
  onBack: () => void;
  backLabel?: string;
  children: ReactNode;
};

/** compact 详情全屏编辑页：顶栏返回 + 正文；配合壳 immersive 隐藏底栏 */
export function DetailEditPageShell({
  title = "编辑",
  onBack,
  backLabel = "返回",
  children,
}: DetailEditPageShellProps) {
  return (
    <div className="bg-background fixed inset-0 z-[70] flex flex-col safe-area-pt safe-area-pb">
      <header className="border flex shrink-0 items-center gap-1 border-b px-2 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={backLabel}
          onClick={onBack}
        >
          <ChevronLeftIcon className="size-5" />
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{title}</h1>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
