import { createFileRoute } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { getStatusConfig } from "@admin/lib/api.ts";
import { m } from "@admin/lib/i18n.ts";
import { catchWithFallback } from "@admin/lib/log-caught-error.ts";

export const Route = createFileRoute("/_sidebar/config")({
  loader: () => getStatusConfig().catch(catchWithFallback("config/getStatusConfig", null)),
  staleTime: 5 * 60_000,
  component: ConfigPage,
});

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function maskSecret(key: string, value: unknown): string {
  const s = value == null ? "" : String(value);
  if (
    key.toLowerCase().includes("key") ||
    key.toLowerCase().includes("token") ||
    key.toLowerCase().includes("secret")
  ) {
    return s ? `${s.slice(0, 8)}…` : m.admin_common_empty();
  }
  return s || m.admin_common_empty();
}

function formatDisplayValue(key: string, value: unknown): string {
  if (value == null) return "null";
  if (value === undefined) return m.admin_common_empty();
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "string") return maskSecret(key, value);
  if (Array.isArray(value)) {
    if (value.every((item) => !isPlainObject(item))) {
      return JSON.stringify(value);
    }
    return JSON.stringify(value, null, 2);
  }
  return JSON.stringify(value, null, 2);
}

function flattenConfigEntries(
  obj: Record<string, unknown>,
  prefix = "",
): Array<{ key: string; value: unknown }> {
  const rows: Array<{ key: string; value: unknown }> = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (isPlainObject(v)) {
      rows.push(...flattenConfigEntries(v, path));
      continue;
    }
    if (Array.isArray(v)) {
      const objectItems = v.filter(isPlainObject);
      if (objectItems.length === v.length && v.length > 0) {
        v.forEach((item, index) => {
          rows.push(...flattenConfigEntries(item as Record<string, unknown>, `${path}[${index}]`));
        });
        continue;
      }
    }
    rows.push({ key: path, value: v });
  }
  return rows;
}

function ConfigBlock({ name, value }: { name: string; value: unknown }) {
  if (isPlainObject(value)) {
    const rows = flattenConfigEntries(value);
    return (
      <Card className="bg-muted py-0">
        <CardContent className="gap-3 py-4 px-4">
          <h3 className="font-bold font-mono text-sm">{name}</h3>
          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">{m.admin_common_empty()}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">{m.admin_common_key_label()}</TableHead>
                    <TableHead>{m.admin_common_value_label()}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ key, value: rowValue }) => (
                    <TableRow key={key}>
                      <TableCell className="font-mono text-xs align-top">{key}</TableCell>
                      <TableCell className="font-mono text-xs whitespace-pre-wrap break-all">
                        {formatDisplayValue(key, rowValue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-muted py-0">
      <CardContent className="gap-2 py-4 px-4">
        <h3 className="font-bold font-mono text-sm">{name}</h3>
        <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-muted p-2 rounded">
          {formatDisplayValue(name, value)}
        </pre>
      </CardContent>
    </Card>
  );
}

function ConfigPage() {
  const config = Route.useLoaderData();

  if (config == null) {
    return (
      <div>
        <h2 className="text-lg font-bold mb-4">{m.admin_nav_config()}</h2>
        <StatusAlert variant="error">{m.admin_common_load_failed_short()}</StatusAlert>
      </div>
    );
  }

  const blocks = Object.entries(config as Record<string, unknown>);

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">{m.admin_nav_config()}</h2>
      <p className="text-sm text-muted-foreground mb-4">{m.admin_config_desc()}</p>
      {blocks.length === 0 ? (
        <StatusAlert variant="info">{m.admin_config_empty()}</StatusAlert>
      ) : (
        <div className="space-y-4">
          {blocks.map(([name, value]) => (
            <ConfigBlock key={name} name={name} value={value} />
          ))}
        </div>
      )}
    </div>
  );
}
