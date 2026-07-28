import { createFileRoute, Link } from "@tanstack/react-router";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { getHabitatSkill } from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { m } from "@freeanima/features/habitat/ui/habitat/lib/i18n.ts";

export const Route = createFileRoute("/_sidebar/skills/$name")({
  loader: async ({ params }) => {
    try {
      return await getHabitatSkill(params.name);
    } catch {
      return null;
    }
  },
  staleTime: 60_000,
  component: SkillDetailPage,
});

function SkillDetailPage() {
  const skill = Route.useLoaderData();
  if (!skill) {
    return (
      <div className="space-y-4 p-4">
        <Link to="/skills" className="text-sm text-primary underline-offset-2 hover:underline">
          {m.habitat_skills_back()}
        </Link>
        <StatusAlert variant="error">{m.habitat_skills_not_found()}</StatusAlert>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <Link to="/skills" className="text-sm text-primary underline-offset-2 hover:underline">
        {m.habitat_skills_back()}
      </Link>
      <div>
        <h1 className="font-mono text-xl font-semibold">{skill.name}</h1>
        <p className="text-sm text-muted-foreground">{skill.description}</p>
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">{m.habitat_skills_col_origin()}</dt>
          <dd className="font-mono">{skill.origin}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{m.habitat_skills_col_status()}</dt>
          <dd className="font-mono">{skill.status}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">world_id</dt>
          <dd className="font-mono">{skill.world_id}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">entity_id</dt>
          <dd className="font-mono">{skill.entity_id}</dd>
        </div>
        {skill.license ? (
          <div>
            <dt className="text-muted-foreground">license</dt>
            <dd>{skill.license}</dd>
          </div>
        ) : null}
        {skill.compatibility ? (
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">compatibility</dt>
            <dd>{skill.compatibility}</dd>
          </div>
        ) : null}
      </dl>
      <div>
        <h2 className="mb-1 text-sm font-semibold">{m.habitat_skills_allowed_tools()}</h2>
        <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
          {skill.allowed_tools.length > 0 ? skill.allowed_tools.join("\n") : "—"}
        </pre>
      </div>
      {skill.denied_tools.length > 0 ? (
        <div>
          <h2 className="mb-1 text-sm font-semibold">{m.habitat_skills_denied_tools()}</h2>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
            {skill.denied_tools.join("\n")}
          </pre>
        </div>
      ) : null}
      {skill.resources.length > 0 ? (
        <div>
          <h2 className="mb-1 text-sm font-semibold">{m.habitat_skills_resources()}</h2>
          <ul className="font-mono text-xs">
            {skill.resources.map((r) => (
              <li key={r.entity_id}>
                {r.path} ({r.kind} #{r.entity_id})
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <h2 className="mb-1 text-sm font-semibold">{m.habitat_skills_body()}</h2>
        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
          {skill.content}
        </pre>
      </div>
    </div>
  );
}
