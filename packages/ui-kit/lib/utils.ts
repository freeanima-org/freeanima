import type { ReactNode } from "react";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { isRecord } from "@freeanima/shared/util";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** react-aria composeRenderProps 的 renderProps 在部分 TS 配置下为 unknown */
export function ariaRenderProps(
  fn: (children: ReactNode, props: Record<string, unknown>) => ReactNode,
): (children: ReactNode, props: unknown) => ReactNode {
  return (children, props) => fn(children, isRecord(props) ? props : {});
}
