import { createTwoFilesPatch } from "diff";
import { useMemo, useState } from "react";

import {
  acceptEditedPendingPatch,
  rejectPendingPatch,
  type PendingPatch,
} from "../lib/tools-executor.ts";

type Props = {
  patches: PendingPatch[];
  onError?: (msg: string) => void;
};

type PathGroup = {
  path: string;
  patches: PendingPatch[];
  oldText: string;
  newText: string;
};

function buildGroups(patches: PendingPatch[]): PathGroup[] {
  const map = new Map<string, PendingPatch[]>();
  for (const p of patches) {
    const list = map.get(p.path) ?? [];
    list.push(p);
    map.set(p.path, list);
  }
  return [...map.entries()].map(([path, list]) => {
    // 顺序叠加：以首条 old 为基，逐条应用 new
    let oldText = list[0]?.old_string ?? "";
    let newText = oldText;
    for (const p of list) {
      if (p.replace_all) {
        newText = newText.split(p.old_string).join(p.new_string);
      } else {
        const i = newText.indexOf(p.old_string);
        if (i >= 0) {
          newText = newText.slice(0, i) + p.new_string + newText.slice(i + p.old_string.length);
        } else {
          // 无法叠加时展示最后一条 new
          newText = p.new_string;
          oldText = p.old_string;
        }
      }
    }
    return { path, patches: list, oldText, newText };
  });
}

export function FilesChangedPanel({ patches, onError }: Props) {
  const groups = useMemo(() => buildGroups(patches), [patches]);
  const [reviewPath, setReviewPath] = useState<string | null>(null);

  const review = groups.find((g) => g.path === reviewPath) ?? groups[0] ?? null;
  const unified =
    review != null
      ? createTwoFilesPatch(review.path, review.path, review.oldText, review.newText, "", "")
      : "";

  if (patches.length === 0) {
    return <p className="muted">暂无待审变更。file_patch 会聚合到此。</p>;
  }

  return (
    <div className="coding-changes">
      <div className="coding-changes-toolbar">
        <button
          type="button"
          className="coding-btn coding-btn-primary"
          onClick={() => {
            void (async () => {
              for (const p of patches) {
                const raw = await acceptEditedPendingPatch(p.id, {
                  old_string: p.old_string,
                  new_string: p.new_string,
                });
                try {
                  const parsed = JSON.parse(raw) as { error?: string };
                  if (parsed.error) onError?.(parsed.error);
                } catch {
                  /* ignore */
                }
              }
            })();
          }}
        >
          Apply Changes
        </button>
        <button
          type="button"
          className="coding-btn"
          onClick={() => {
            for (const p of patches) rejectPendingPatch(p.id);
          }}
        >
          Reject All
        </button>
        <span className="muted">
          {groups.length} 文件 · {patches.length} patch
        </span>
      </div>

      <ul className="coding-changes-files">
        {groups.map((g) => (
          <li key={g.path}>
            <button
              type="button"
              className={
                review?.path === g.path ? "coding-changes-file active" : "coding-changes-file"
              }
              onClick={() => setReviewPath(g.path)}
            >
              <code>{g.path}</code>
              <span className="muted">{g.patches.length}</span>
            </button>
            <div className="coding-changes-file-actions">
              {g.patches.map((p) => (
                <span key={p.id} className="coding-changes-mini">
                  <button
                    type="button"
                    className="coding-btn"
                    onClick={() => {
                      void acceptEditedPendingPatch(p.id, {
                        old_string: p.old_string,
                        new_string: p.new_string,
                      }).then((raw) => {
                        try {
                          const parsed = JSON.parse(raw) as { error?: string };
                          if (parsed.error) onError?.(parsed.error);
                        } catch {
                          /* ignore */
                        }
                      });
                    }}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="coding-btn"
                    onClick={() => rejectPendingPatch(p.id)}
                  >
                    Reject
                  </button>
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {review ? (
        <div className="coding-changes-review">
          <h3>Review · {review.path}</h3>
          <pre className="coding-unified-diff">{unified}</pre>
        </div>
      ) : null}
    </div>
  );
}
