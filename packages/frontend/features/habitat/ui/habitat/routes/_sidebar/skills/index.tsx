import { createFileRoute, Link } from "@tanstack/react-router";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { listHabitatSkills } from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { catchWithFallback } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";

export const Route = createFileRoute("/_sidebar/skills/")({
  loader: () =>
    listHabitatSkills().catch(catchWithFallback("skills/listHabitatSkills", { skills: [] })),
  staleTime: 60_000,
  component: SkillsPage,
});

function SkillsPage() {
  const data = Route.useLoaderData();
  const skills = data.skills ?? [];

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">{"技能"}</h1>
        <p className="text-sm text-muted-foreground">{"只读技能目录（Commons + Agent 私有）。"}</p>
      </div>
      {skills.length === 0 ? (
        <StatusAlert variant="info">{"尚未注册技能。"}</StatusAlert>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{"名称"}</TableHead>
              <TableHead>{"描述"}</TableHead>
              <TableHead>{"来源"}</TableHead>
              <TableHead>{"状态"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {skills.map((s) => (
              <TableRow key={`${s.world_id}:${s.name}`}>
                <TableCell>
                  <Link
                    to="/skills/$name"
                    params={{ name: s.name }}
                    className="font-mono text-sm text-primary underline-offset-2 hover:underline"
                  >
                    {s.name}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.description}</TableCell>
                <TableCell className="font-mono text-xs">{s.origin}</TableCell>
                <TableCell className="font-mono text-xs">{s.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
