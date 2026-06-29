import type { DiarySubjectKind } from "../lib/format-diary.ts";

export function SubjectToggle({
  value,
  onChange,
}: {
  value: DiarySubjectKind;
  onChange: (kind: DiarySubjectKind) => void;
}) {
  return (
    <div className="join">
      <button
        type="button"
        className={`btn btn-sm join-item ${value === "user" ? "btn-primary" : "btn-ghost"}`}
        onClick={() => onChange("user")}
      >
        用户
      </button>
      <button
        type="button"
        className={`btn btn-sm join-item ${value === "agent" ? "btn-primary" : "btn-ghost"}`}
        onClick={() => onChange("agent")}
      >
        Agent
      </button>
    </div>
  );
}
