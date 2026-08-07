import { useEffect, useState } from "react";
import { Button, FormField, FormToggle, Input } from "@freeanima/ui-kit";

export type VaultPasswordGeneratorOptions = {
  length: number;
  upper: boolean;
  lower: boolean;
  digits: boolean;
  symbols: boolean;
};

const defaultOpts = (): VaultPasswordGeneratorOptions => ({
  length: 16,
  upper: true,
  lower: true,
  digits: true,
  symbols: false,
});

export function VaultPasswordGeneratorPanel({
  generate,
  onFill,
}: {
  generate: (opts: VaultPasswordGeneratorOptions) => Promise<string>;
  /** 可选：填入当前页焦点 */
  onFill?: (password: string) => void | Promise<void>;
}) {
  const [opts, setOpts] = useState(defaultOpts);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    setError("");
    try {
      setPassword(await generate(opts));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
        <code className="min-w-0 flex-1 break-all text-sm">{password || "—"}</code>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="重新生成"
          onClick={() => void refresh()}
        >
          ↻
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="复制"
          disabled={!password}
          onClick={() => void navigator.clipboard.writeText(password)}
        >
          ⧉
        </Button>
      </div>
      <FormField label="长度（5–128）">
        <Input
          type="number"
          min={5}
          max={128}
          value={String(opts.length)}
          onChange={(e) =>
            setOpts((prev) => ({
              ...prev,
              length: Math.min(128, Math.max(5, Number(e.target.value) || 16)),
            }))
          }
        />
      </FormField>
      <div className="flex flex-col gap-1">
        {(
          [
            ["upper", "大写 A–Z"],
            ["lower", "小写 a–z"],
            ["digits", "数字 0–9"],
            ["symbols", "符号"],
          ] as const
        ).map(([key, label]) => (
          <FormToggle
            key={key}
            label={label}
            checked={opts[key]}
            onChange={(selected) => setOpts((prev) => ({ ...prev, [key]: selected }))}
          />
        ))}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void refresh()}>
          重新生成
        </Button>
        {onFill ? (
          <Button
            type="button"
            variant="outline"
            disabled={!password}
            onClick={() => void onFill(password)}
          >
            填入页面
          </Button>
        ) : null}
      </div>
    </div>
  );
}
