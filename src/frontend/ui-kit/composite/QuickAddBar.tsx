import { Button } from "../components/ui/button.tsx";
import { Input } from "../components/ui/input.tsx";

type QuickAddBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  submitLabel?: string;
};

export function QuickAddBar({
  value,
  onChange,
  onSubmit,
  placeholder = "添加任务，Enter 确认",
  disabled = false,
  submitLabel = "添加",
}: QuickAddBarProps) {
  return (
    <div className="border safe-area-pb flex shrink-0 gap-2 border-t p-3">
      <Input
        className="min-w-0 flex-1"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
        }}
      />
      <Button type="button" disabled={disabled} onClick={onSubmit}>
        {submitLabel}
      </Button>
    </div>
  );
}
