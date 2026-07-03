type EntityIdLabelProps = {
  id: number;
  className?: string;
};

export function EntityIdLabel({ id, className = "" }: EntityIdLabelProps) {
  return (
    <span
      className={`text-foreground/40 shrink-0 font-mono text-xs tabular-nums ${className}`.trim()}
      title={`ID ${id}`}
    >
      #{id}
    </span>
  );
}
