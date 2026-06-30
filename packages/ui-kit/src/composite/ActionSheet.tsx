import type { ReactNode } from "react";

import { cn } from "../lib/cn.ts";
import { m } from "./i18n.ts";
import type { ActionSheetItem } from "./types.ts";

export type ActionSheetProps = {
  title?: ReactNode;
  items: ActionSheetItem[];
  dismissLabel?: ReactNode;
  onClose: () => void;
  className?: string;
};

export function ActionSheet({ title, items, dismissLabel, onClose, className }: ActionSheetProps) {
  return (
    <dialog className={cn("modal modal-open modal-bottom sm:modal-middle", className)} open>
      <div className="modal-box w-full max-w-lg rounded-t-2xl p-0 sm:rounded-box safe-area-pb">
        {title != null && title !== "" ? (
          <div className="border-base-300 border-b px-4 py-3">
            <p className="text-sm font-semibold">{title}</p>
          </div>
        ) : null}
        <ul className="menu menu-lg rounded-none p-2">
          {items.map((item) => (
            <li key={item.label}>
              <button
                type="button"
                className={item.danger ? "text-error" : undefined}
                onClick={() => {
                  item.onClick();
                  onClose();
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
        <div className="border-base-300 border-t p-2">
          <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
            {dismissLabel ?? m.ui_common_cancel()}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose}>
          close
        </button>
      </form>
    </dialog>
  );
}
