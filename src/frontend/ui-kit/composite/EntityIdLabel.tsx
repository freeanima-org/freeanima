import { formatAnimaUri } from "@freeanima/frontend/shell-sdk/anima-uri.ts";

type EntityIdLabelProps = {
  id: number;
  className?: string;
  /**
   * When set, click copies Anima URI `anima:{id}?component=…`.
   */
  animaComponent?: string;
};

export function EntityIdLabel({ id, className = "", animaComponent }: EntityIdLabelProps) {
  const label = `#${id}`;
  const title = animaComponent
    ? `复制 Anima URI（${formatAnimaUri({ id, component: animaComponent })}）`
    : `ID ${id}`;

  if (!animaComponent) {
    return (
      <span
        className={`text-foreground/40 shrink-0 font-mono text-xs tabular-nums ${className}`.trim()}
        title={title}
      >
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`text-foreground/40 hover:text-foreground shrink-0 font-mono text-xs tabular-nums ${className}`.trim()}
      title={title}
      aria-label={title}
      onClick={() => {
        const uri = formatAnimaUri({ id, component: animaComponent });
        void navigator.clipboard.writeText(uri);
      }}
    >
      {label}
    </button>
  );
}
