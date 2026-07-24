import { useCallback, useState } from "react";
import { Button } from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import {
  testHabitatConfigConnection,
  type HabitatConfigTestService,
} from "@freeanima/client/portal-sdk/habitat-config-api";

type Props = {
  service: HabitatConfigTestService;
  config: Record<string, unknown>;
  providerId?: string;
  disabled?: boolean;
};

export function HabitatConfigConnectionTestButton({
  service,
  config,
  providerId,
  disabled = false,
}: Props) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const runTest = useCallback(async () => {
    setTesting(true);
    setResult(null);
    try {
      const out = await testHabitatConfigConnection({
        service,
        config,
        ...(providerId ? { provider_id: providerId } : {}),
      });
      setResult(out);
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setTesting(false);
    }
  }, [config, providerId, service]);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || testing}
        onClick={() => void runTest()}
      >
        {testing ? "测试中…" : "测试连接"}
      </Button>
      {result ? (
        <StatusAlert variant={result.ok ? "success" : "error"} className="text-sm">
          {result.message}
        </StatusAlert>
      ) : null}
    </div>
  );
}
