import { useDrawerNav } from "./viewport.ts";

export type ThreeColumnLayoutMode = "compact" | "wide";

/** compact：清单 drawer + 底滑详情；wide（≥ md）：三栏并列 */
export function useThreeColumnLayoutMode(): ThreeColumnLayoutMode {
  const useDrawer = useDrawerNav();
  return useDrawer ? "compact" : "wide";
}
