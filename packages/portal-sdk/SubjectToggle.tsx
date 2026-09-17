import type { SubjectKind } from "./subject-scope.ts";

const baseBtn =
  "inline-flex h-8 items-center justify-center px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
const activeBtn = "bg-primary text-primary-foreground hover:bg-primary/90";
const inactiveBtn = "bg-background text-foreground hover:bg-accent hover:text-accent-foreground";

export function SubjectToggle({
  value,
  onChange,
}: {
  value: SubjectKind;
  onChange: (kind: SubjectKind) => void;
}) {
  return (
    <div className="inline-flex rounded-md border shadow-xs" role="group" aria-label="主体切换">
      <button
        type="button"
        className={`${baseBtn} rounded-l-md ${value === "user" ? activeBtn : inactiveBtn}`}
        aria-pressed={value === "user"}
        onClick={() => onChange("user")}
      >
        用户
      </button>
      <button
        type="button"
        className={`${baseBtn} rounded-r-md border-l ${value === "agent" ? activeBtn : inactiveBtn}`}
        aria-pressed={value === "agent"}
        onClick={() => onChange("agent")}
      >
        Agent
      </button>
    </div>
  );
}
