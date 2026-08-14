import type { ReactNode } from "react";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** react-aria composeRenderProps 的 renderProps 在部分 TS 配置下为 unknown */
export function ariaRenderProps(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RAC renderProps 泛型过窄
  fn: (children: ReactNode, props: any) => ReactNode,
): (children: ReactNode, props: unknown) => ReactNode {
  return fn;
}
