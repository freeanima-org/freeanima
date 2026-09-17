import { SubjectToggle } from "./SubjectToggle.tsx";
import { useSubjectScope } from "./subject-scope-react.tsx";

type Props = {
  className?: string;
};

/** 绑定全局 subject scope 的用户/Agent 切换，仅放在需要区分主体的功能页内。 */
export function SubjectScopeToggle({ className }: Props) {
  const { kind, setKind } = useSubjectScope();
  return (
    <div className={className}>
      <SubjectToggle value={kind} onChange={setKind} />
    </div>
  );
}
