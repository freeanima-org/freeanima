import type { SubjectKind } from "./subject-scope.ts";

export function SubjectToggle({
  value,
  onChange,
}: {
  value: SubjectKind;
  onChange: (kind: SubjectKind) => void;
}) {
  return (
    <div className="join" role="group" aria-label="主体切换">
      <button
        type="button"
        className={`btn btn-sm join-item ${value === "user" ? "btn-primary" : "btn-ghost"}`}
        aria-pressed={value === "user"}
        onClick={() => onChange("user")}
      >
        用户
      </button>
      <button
        type="button"
        className={`btn btn-sm join-item ${value === "agent" ? "btn-primary" : "btn-ghost"}`}
        aria-pressed={value === "agent"}
        onClick={() => onChange("agent")}
      >
        Agent
      </button>
    </div>
  );
}
