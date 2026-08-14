import type { ComponentType, SVGProps } from "react";

/** Shell 导航图标（替代 lucide-react 的 LucideIcon，避免 oxlint error 化） */
export type AppNavIcon = ComponentType<SVGProps<SVGSVGElement>>;
