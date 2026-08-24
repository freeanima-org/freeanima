import { useEffect } from "react";
import { Spinner } from "@freeanima/ui-kit";
import { shellProductHref } from "@freeanima/features/habitat/ui/habitat/lib/habitat-nav.ts";

/** Anima 私有空间（卧室）已迁至顶级 /bedroom；栖息地旧路径跳转。 */
export function RedirectToBedroom({ subpath }: { subpath: string }) {
  useEffect(() => {
    const path = subpath.startsWith("/") ? subpath : `/${subpath}`;
    window.location.replace(shellProductHref(`/bedroom${path}`));
  }, [subpath]);
  return (
    <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
      <Spinner className="size-4" />
      正在前往卧室…
    </div>
  );
}
