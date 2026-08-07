/**
 * 项目 Agent 资产发现：`.agents` 优先，再厂商兼容路径。
 * 不扫描 `.anima/` 下的 skills/rules/agents/mcp。
 */

import type {
  ProjectAgentContext,
  ProjectAgentProfile,
  ProjectAssetSource,
  ProjectMcpServer,
  ProjectRule,
  ProjectSkill,
} from "./types.ts";
import { parseMcpJsonDocument } from "./mcp-parse.ts";
import type { ProjectVfs } from "./vfs.ts";

const MAX_RULE_CHARS = 12_000;
const MAX_SKILL_BODY_CHARS = 40_000;
const MAX_AGENT_BODY_CHARS = 20_000;

const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.floor(max * 0.85))}\n\n[... truncated ...]`;
}

function parseSimpleFrontmatter(text: string): {
  meta: Record<string, string>;
  body: string;
} {
  const lines = text.split("\n");
  if (lines[0]?.trim() !== "---") return { meta: {}, body: text.trim() };
  const meta: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "---") {
      return {
        meta,
        body: lines
          .slice(i + 1)
          .join("\n")
          .trim(),
      };
    }
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (m?.[1]) meta[m[1]] = (m[2] ?? "").trim().replace(/^["']|["']$/g, "");
  }
  return { meta: {}, body: text.trim() };
}

async function safeRead(vfs: ProjectVfs, path: string): Promise<string | null> {
  try {
    if (!(await vfs.exists(path))) return null;
    if (await vfs.isDir(path)) return null;
    return await vfs.readText(path);
  } catch {
    return null;
  }
}

async function listSkillDirs(
  vfs: ProjectVfs,
  root: string,
): Promise<Array<{ name: string; skillMd: string }>> {
  if (!(await vfs.exists(root)) || !(await vfs.isDir(root))) return [];
  const out: Array<{ name: string; skillMd: string }> = [];
  const entries = await vfs.listDir(root);
  for (const ent of entries) {
    if (ent.kind !== "dir") continue;
    const skillMd = `${root}/${ent.name}/SKILL.md`;
    if (await vfs.exists(skillMd)) out.push({ name: ent.name, skillMd });
  }
  return out;
}

async function walkMdFiles(vfs: ProjectVfs, root: string, max = 80): Promise<string[]> {
  if (!(await vfs.exists(root)) || !(await vfs.isDir(root))) return [];
  const out: string[] = [];
  const queue = [root];
  while (queue.length > 0 && out.length < max) {
    const dir = queue.shift();
    if (dir == null) break;
    let entries;
    try {
      entries = await vfs.listDir(dir);
    } catch {
      continue;
    }
    for (const ent of entries) {
      const p = `${dir}/${ent.name}`;
      if (ent.kind === "dir") {
        if (ent.name === "node_modules" || ent.name === ".git") continue;
        queue.push(p);
      } else if (ent.name.endsWith(".md") || ent.name.endsWith(".mdc")) {
        out.push(p);
      }
    }
  }
  return out;
}

function claimName(map: Map<string, unknown>, name: string): boolean {
  if (map.has(name)) return false;
  map.set(name, true);
  return true;
}

async function discoverSkills(vfs: ProjectVfs): Promise<ProjectSkill[]> {
  const claimed = new Map<string, unknown>();
  const skills: ProjectSkill[] = [];

  const roots: Array<{ dir: string; source: ProjectAssetSource }> = [
    { dir: ".agents/skills", source: "agents" },
    { dir: ".claude/skills", source: "claude" },
    { dir: ".opencode/skills", source: "opencode" },
    { dir: ".cursor/skills", source: "cursor" },
  ];

  for (const { dir, source } of roots) {
    for (const { name: dirName, skillMd } of await listSkillDirs(vfs, dir)) {
      const text = await safeRead(vfs, skillMd);
      if (text == null) continue;
      const { meta, body } = parseSimpleFrontmatter(text);
      const name = (meta.name || dirName).trim().toLowerCase();
      if (!SKILL_NAME_RE.test(name)) continue;
      if (!claimName(claimed, name)) continue;
      const description = (meta.description || "").trim() || "(no description)";
      skills.push({
        name,
        description,
        path: skillMd,
        source,
        body: truncate(body, MAX_SKILL_BODY_CHARS),
      });
    }
  }
  return skills;
}

async function discoverAgents(vfs: ProjectVfs): Promise<ProjectAgentProfile[]> {
  const claimed = new Map<string, unknown>();
  const agents: ProjectAgentProfile[] = [];

  const roots: Array<{ dir: string; source: ProjectAssetSource }> = [
    { dir: ".agents/agents", source: "agents" },
    { dir: ".opencode/agents", source: "opencode" },
    { dir: ".claude/agents", source: "claude" },
  ];

  for (const { dir, source } of roots) {
    if (!(await vfs.exists(dir)) || !(await vfs.isDir(dir))) continue;
    const entries = await vfs.listDir(dir);
    for (const ent of entries) {
      if (ent.kind !== "file") continue;
      if (!ent.name.endsWith(".md") && !ent.name.endsWith(".agent.md")) continue;
      const path = `${dir}/${ent.name}`;
      const text = await safeRead(vfs, path);
      if (text == null) continue;
      const { meta, body } = parseSimpleFrontmatter(text);
      const slug = (meta.name || ent.name.replace(/\.agent\.md$/i, "").replace(/\.md$/i, ""))
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      if (!slug || !claimName(claimed, slug)) continue;
      const allowed =
        meta["allowed-tools"] || meta.allowed_tools
          ? (meta["allowed-tools"] || meta.allowed_tools || "")
              .split(/[\s,]+/)
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined;
      agents.push({
        slug,
        description: (meta.description || "").trim() || slug,
        path,
        source,
        content: truncate(body, MAX_AGENT_BODY_CHARS),
        ...(allowed && allowed.length > 0 ? { allowed_tools: allowed } : {}),
      });
    }
  }
  return agents;
}

function cursorRuleKind(meta: Record<string, string>): {
  kind: ProjectRule["kind"];
  globs?: string[];
} {
  const alwaysApply = meta.alwaysApply === "true" || meta.always === "true";
  const globs = meta.globs
    ? meta.globs
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;
  if (alwaysApply) return { kind: "always" };
  if (globs && globs.length > 0) return { kind: "requestable", globs };
  // Cursor: alwaysApply false + no globs → agent requested
  if (meta.alwaysApply === "false") return { kind: "requestable" };
  return { kind: "always" };
}

async function discoverRules(vfs: ProjectVfs): Promise<ProjectRule[]> {
  const rules: ProjectRule[] = [];
  const seenPath = new Set<string>();

  const pushFile = async (
    path: string,
    source: ProjectAssetSource,
    kindForce?: ProjectRule["kind"],
  ) => {
    if (seenPath.has(path)) return;
    const text = await safeRead(vfs, path);
    if (text == null || !text.trim()) return;
    seenPath.add(path);
    const { meta, body } = parseSimpleFrontmatter(text);
    const cursor = path.includes(".cursor/rules")
      ? cursorRuleKind(meta)
      : { kind: "always" as const };
    const kind = kindForce ?? cursor.kind;
    rules.push({
      id: `${source}:${path}`,
      path,
      kind,
      content: truncate(
        kind === "always" ? body || text.trim() : body || text.trim(),
        MAX_RULE_CHARS,
      ),
      source,
      ...(cursor.globs ? { globs: cursor.globs } : {}),
    });
  };

  // AGENTS.md（社区通用）
  await pushFile("AGENTS.md", "agents-md", "always");
  // CLAUDE.md
  await pushFile("CLAUDE.md", "claude-md", "always");
  await pushFile(".claude/CLAUDE.md", "claude", "always");

  for (const p of await walkMdFiles(vfs, ".agents/rules")) {
    await pushFile(p, "agents");
  }
  for (const p of await walkMdFiles(vfs, ".claude/rules")) {
    await pushFile(p, "claude");
  }
  for (const p of await walkMdFiles(vfs, ".cursor/rules")) {
    await pushFile(p, "cursor");
  }

  // 显式不读 .anima/**

  return rules;
}

async function discoverMcp(vfs: ProjectVfs): Promise<ProjectMcpServer[]> {
  const claimed = new Map<string, unknown>();
  const servers: ProjectMcpServer[] = [];

  const files: Array<{ path: string; source: ProjectAssetSource }> = [
    { path: ".agents/mcp.json", source: "agents" },
    { path: ".mcp.json", source: "mcp-root" },
    { path: ".vscode/mcp.json", source: "mcp-vscode" },
    { path: ".cursor/mcp.json", source: "mcp-cursor" },
  ];

  for (const { path, source } of files) {
    const text = await safeRead(vfs, path);
    if (text == null) continue;
    const parsed = parseMcpJsonDocument(text);
    for (const [name, config] of Object.entries(parsed)) {
      if (!claimName(claimed, name)) continue;
      if (config.enabled === false) continue;
      servers.push({ name, config, source, path });
    }
  }
  return servers;
}

export async function discoverProjectAgentContext(vfs: ProjectVfs): Promise<ProjectAgentContext> {
  const [rules, skills, agents, mcpServers] = await Promise.all([
    discoverRules(vfs),
    discoverSkills(vfs),
    discoverAgents(vfs),
    discoverMcp(vfs),
  ]);

  const sources = new Set<ProjectAssetSource>();
  for (const r of rules) sources.add(r.source);
  for (const s of skills) sources.add(s.source);
  for (const a of agents) sources.add(a.source);
  for (const m of mcpServers) sources.add(m.source);

  return {
    rules,
    skills,
    agents,
    mcpServers,
    /** 社区通用；始终可写（不存在则创建） */
    agentsMdPath: "AGENTS.md",
    sources: [...sources],
  };
}

/** 保证 agentsMdPath 始终为 AGENTS.md（可创建） */
export function withWritableAgentsMd(ctx: ProjectAgentContext): ProjectAgentContext {
  return { ...ctx, agentsMdPath: "AGENTS.md" };
}
