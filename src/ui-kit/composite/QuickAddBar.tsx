import { Button } from "../components/ui/button.tsx";
import { Input } from "../components/ui/input.tsx";

type QuickAddBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  submitLabel?: string;
  /**
   * Enter 提交（交互维）。单行快速添加默认 true；多行输入应注入 `useEnterToSendCapability()`。
   * touch 路径始终保留可见提交钮，不依赖键盘 Enter。
   */
  enterToSubmit?: boolean;
  /** 默认底部栏（border-t）；顶部放置时传 className 覆盖边框方向 */
  className?: string;
};

export function QuickAddBar({
  value,
  onChange,
  onSubmit,
  placeholder = "添加任务，Enter 确认",
  disabled = false,
  submitLabel = "添加",
  enterToSubmit = true,
  className = "border safe-area-pb flex shrink-0 gap-2 border-t p-3",
}: QuickAddBarProps) {
  return (
    <div className={className}>
      <Input
        className="min-w-0 flex-1"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && enterToSubmit) onSubmit();
        }}
      />
      <Button type="button" className="min-h-11 shrink-0" disabled={disabled} onClick={onSubmit}>
        {submitLabel}
      </Button>
    </div>
  );
}
