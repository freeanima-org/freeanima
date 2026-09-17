import { useSyncExternalStore } from "react";
import type { ReactElement, ReactNode } from "react";

import { ConfirmDialog } from "./ConfirmDialog.tsx";
import type { ConfirmDialogVariant } from "./types.ts";

export type ShowConfirmOptions = {
  title?: ReactNode;
  description?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  variant?: ConfirmDialogVariant;
};

type PendingPrompt = {
  kind: "confirm" | "alert";
  options: ShowConfirmOptions;
  resolve: (value: boolean) => void;
};

let current: PendingPrompt | null = null;
const queue: PendingPrompt[] = [];
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): PendingPrompt | null {
  return current;
}

function emit(): void {
  for (const listener of listeners) listener();
}

function enqueue(prompt: PendingPrompt): void {
  if (!current) {
    current = prompt;
  } else {
    queue.push(prompt);
  }
  emit();
}

function settle(confirmed: boolean): void {
  if (!current) return;
  current.resolve(confirmed);
  current = queue.shift() ?? null;
  emit();
}

/** 全局确认框（Promise）；须在根节点挂载 `<ConfirmPromptHost />` */
export function showConfirm(options: ShowConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    enqueue({
      kind: "confirm",
      options,
      resolve,
    });
  });
}

/** 全局提示框（仅确认按钮） */
export function showAlert(options: ShowConfirmOptions | string): Promise<void> {
  const opts = typeof options === "string" ? { description: options } : options;
  return new Promise((resolve) => {
    enqueue({
      kind: "alert",
      options: {
        title: opts.title ?? "提示",
        ...opts,
      },
      resolve: () => resolve(),
    });
  });
}

export function ConfirmPromptHost(): ReactElement | null {
  const pending = useSyncExternalStore(subscribe, getSnapshot, () => null);
  if (!pending) return null;

  const { kind, options } = pending;
  const title = options.title ?? "确定";
  const description = options.description;

  return (
    <ConfirmDialog
      open
      title={title}
      description={description}
      confirmLabel={options.confirmLabel}
      cancelLabel={options.cancelLabel}
      {...(options.variant ? { variant: options.variant } : {})}
      cancelable={kind === "confirm"}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );
}
