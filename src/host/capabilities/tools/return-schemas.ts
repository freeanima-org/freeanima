import {
  defineTextToolReturn,
  defineToolReturn,
  textLineNumberExample,
  type ToolReturnContractFields,
  z,
} from "@freeanima/host/core/tool";

const catalogEntrySchema = z.object({
  name: z.string(),
  description: z.string(),
  toolset: z.string(),
  allowed: z.boolean(),
});

const toolCatalogMessageEntrySchema = z.object({
  name: z.string(),
  description: z.string(),
  toolset: z.string(),
  parameters: z.record(z.string(), z.unknown()),
  return_schema: z.record(z.string(), z.unknown()).optional(),
});

const okPathSchema = z.object({ ok: z.literal(true), path: z.string() });

const fileSearchFilesUnionSchema = z.union([
  z.object({ files: z.array(z.string()), total: z.number() }),
  z.object({ matches: z.array(z.string()), total_lines: z.number(), truncated: z.boolean() }),
  z.object({ counts: z.array(z.string()), raw: z.string() }),
]);

const browserSuccessSchema = z.object({ success: z.literal(true) });

const browserNavigateSchema = browserSuccessSchema.extend({
  url: z.string(),
  title: z.string(),
  snapshot: z.string().optional(),
  element_count: z.number().optional(),
  vnc_url: z.string().optional(),
  vnc_hint: z.string().optional(),
});

const browserSnapshotSchema = browserSuccessSchema.extend({
  snapshot: z.string(),
  element_count: z.number(),
});

const browserClickSchema = browserSuccessSchema.extend({
  clicked: z.string(),
  url: z.string(),
});

const browserTypeSchema = browserSuccessSchema.extend({
  typed: z.string(),
  element: z.string(),
});

const browserScrollSchema = browserSuccessSchema.extend({
  scrolled: z.string(),
});

const browserUrlSchema = browserSuccessSchema.extend({
  url: z.string(),
});

const browserPressSchema = browserSuccessSchema.extend({
  pressed: z.string(),
});

const browserConsoleSchema = browserSuccessSchema.extend({
  habitat_messages: z.array(z.unknown()),
  js_errors: z.array(z.unknown()),
  note: z.string().optional(),
});

const browserImagesSchema = browserSuccessSchema.extend({
  images: z.array(z.object({ url: z.string(), alt: z.string() })),
  count: z.number(),
});

const browserVisionSchema = browserSuccessSchema.extend({
  screenshot_path: z.string(),
  question: z.string(),
  analysis: z.null(),
  note: z.string(),
  snapshot_excerpt: z.string().optional(),
});

const webSearchResultSchema = z.object({
  results: z.array(z.object({ title: z.string(), url: z.string(), description: z.string() })),
  total: z.number(),
});

const webExtractResultSchema = z.object({
  results: z.array(
    z.object({
      url: z.string(),
      title: z.string(),
      content: z.string(),
      error: z.string().nullable(),
    }),
  ),
});

const skillListEntrySchema = z.object({
  name: z.string(),
  description: z.string(),
  source: z.string().optional(),
  directory: z.string(),
});

const sessionSearchHitSchema = z.object({
  conversation_id: z.string(),
  message_id: z.string(),
  role: z.string(),
  timestamp: z.string(),
  snippet: z.string(),
});

const sessionMessageRowSchema = z.object({
  id: z.string(),
  role: z.string(),
  content: z.string(),
  pos: z.number(),
  timestamp: z.string().optional(),
});

const todoItemSchema = z.object({
  id: z.number(),
  content: z.string(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
  created_at: z.string(),
  updated_at: z.string().optional(),
});

const todoReturnSchema = z.union([
  z.object({
    ok: z.literal(true),
    todos: z.array(todoItemSchema),
    message: z.string(),
  }),
  z.object({
    ok: z.literal(true),
    action: z.literal("add"),
    todo: todoItemSchema,
    message: z.string(),
  }),
  z.object({
    ok: z.literal(true),
    action: z.literal("update"),
    id: z.number(),
    status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
    message: z.string(),
  }),
  z.object({
    ok: z.literal(true),
    action: z.literal("delete"),
    id: z.number(),
    message: z.string(),
  }),
]);

export const CAPABILITIES_TOOLS_RETURNS: Record<string, ToolReturnContractFields> = {
  toolset_search: defineToolReturn({
    schema: z.object({
      query: z.string(),
      hits: z.array(
        z.object({
          toolset: z.string(),
          description: z.string(),
          tools: z.array(catalogEntrySchema),
          allowed: z.boolean(),
        }),
      ),
      total: z.number(),
    }),
    example: {
      query: "postgres",
      hits: [
        {
          toolset: "mcp_postgres",
          description: "MCP postgres",
          tools: [
            {
              name: "mcp_postgres_query",
              description: "Run SQL",
              toolset: "mcp_postgres",
              allowed: true,
            },
          ],
          allowed: true,
        },
      ],
      total: 1,
    },
  }),
  toolset_load: defineToolReturn({
    schema: z.object({
      loaded: z.array(z.string()),
      denied: z.array(z.string()),
      already_loaded: z.array(z.string()),
      unknown: z.array(z.string()),
      tools: z.array(toolCatalogMessageEntrySchema),
    }),
    example: {
      loaded: ["file"],
      denied: [],
      already_loaded: [],
      unknown: [],
      tools: [
        {
          name: "file_read",
          description: "Read a text file",
          toolset: "file",
          parameters: { type: "object", properties: {} },
        },
      ],
    },
  }),
  file_read: defineTextToolReturn({
    hint: "Plain text with line numbers; each line formatted as offset|line_content",
    example: textLineNumberExample,
  }),
  file_write: defineToolReturn({
    schema: okPathSchema,
    example: { ok: true, path: "/home/user/project/README.md" },
  }),
  file_delete: defineToolReturn({
    schema: okPathSchema,
    example: { ok: true, path: "/home/user/project/tmp.txt" },
  }),
  file_search: defineToolReturn({
    schema: fileSearchFilesUnionSchema,
    example: {
      matches: ["./src/index.ts:10:export function main()"],
      total_lines: 1,
      truncated: false,
    },
  }),
  file_patch: defineToolReturn({
    schema: okPathSchema,
    example: { ok: true, path: "/home/user/project/src/app.ts" },
  }),
  terminal_run: defineTextToolReturn({
    hint: "Command stdout/stderr plain text; non-zero exit appends --- exit code: N ---; background mode returns conversation_id hint. Default shell=false; catastrophic rm targets always blocked.",
    example: "hello world\n--- exit code: 0 ---",
  }),
  terminal_process: defineTextToolReturn({
    hint: "Plain text: list/poll/log/wait/kill status and output",
    example: "running\nprocess output line",
  }),
  code_execute: defineTextToolReturn({
    hint: "Child stdout/stderr plain text; non-zero exit appends --- exit code: N ---",
    example: "42\n--- exit code: 0 ---",
  }),
  browser_navigate: defineToolReturn({
    schema: browserNavigateSchema,
    example: {
      success: true,
      url: "https://example.com",
      title: "Example Domain",
      snapshot: '[@e1] link "More information..."',
      element_count: 1,
    },
  }),
  browser_snapshot: defineToolReturn({
    schema: browserSnapshotSchema,
    example: {
      success: true,
      snapshot: '[@e1] button "Submit"',
      element_count: 1,
    },
  }),
  browser_click: defineToolReturn({
    schema: browserClickSchema,
    example: { success: true, clicked: "e1", url: "https://example.com/clicked" },
  }),
  browser_type: defineToolReturn({
    schema: browserTypeSchema,
    example: { success: true, typed: "hello", element: "e2" },
  }),
  browser_scroll: defineToolReturn({
    schema: browserScrollSchema,
    example: { success: true, scrolled: "down" },
  }),
  browser_back: defineToolReturn({
    schema: browserUrlSchema,
    example: { success: true, url: "https://example.com/" },
  }),
  browser_press: defineToolReturn({
    schema: browserPressSchema,
    example: { success: true, pressed: "Enter" },
  }),
  browser_console: defineToolReturn({
    schema: browserConsoleSchema,
    example: {
      success: true,
      habitat_messages: [],
      js_errors: [],
      note: "Camofox backend does not support console capture yet",
    },
  }),
  browser_get_images: defineToolReturn({
    schema: browserImagesSchema,
    example: {
      success: true,
      images: [{ url: "https://example.com/logo.png", alt: "Logo" }],
      count: 1,
    },
  }),
  browser_vision: defineToolReturn({
    schema: browserVisionSchema,
    example: {
      success: true,
      screenshot_path: "/home/user/.anima/browser_screenshots/browser_screenshot_a1b2c3d4.png",
      question: "What buttons are on the page?",
      analysis: null,
      note: "Free Anima has no auxiliary vision LLM yet; screenshot saved to screenshot_path.",
    },
  }),
  web_search: defineToolReturn({
    schema: webSearchResultSchema,
    example: {
      results: [
        {
          title: "Example",
          url: "https://example.com",
          description: "An example search result",
        },
      ],
      total: 1,
    },
  }),
  web_extract: defineToolReturn({
    schema: webExtractResultSchema,
    example: {
      results: [
        {
          url: "https://example.com",
          title: "Example Domain",
          content: "# Example Domain\n\nThis domain is for use in documentation.",
          error: null,
        },
      ],
    },
  }),
  skill_create: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      name: z.string(),
      description: z.string(),
      message: z.string(),
    }),
    example: {
      ok: true,
      name: "my-skill",
      description: "Example skill",
      message: "Skill 'my-skill' created and registered",
    },
  }),
  skill_load: defineToolReturn({
    schema: z.object({
      skill: z.string(),
      description: z.string(),
      source: z.string().optional(),
      content: z.string(),
    }),
    example: {
      skill: "my-skill",
      description: "Example skill",
      source: "user",
      content: "# My Skill\n\nSkill body",
    },
  }),
  skill_list: defineToolReturn({
    schema: z.object({
      skills: z.array(skillListEntrySchema),
      total: z.number(),
      message: z.string().optional(),
    }),
    example: {
      skills: [
        {
          name: "my-skill",
          description: "Example skill",
          source: "user",
          directory: "/home/user/.anima/skills",
        },
      ],
      total: 1,
    },
  }),
  skill_search: defineToolReturn({
    schema: z.object({
      query: z.string(),
      skills: z.array(skillListEntrySchema),
      total: z.number(),
    }),
    example: {
      query: "demo",
      skills: [
        {
          name: "my-skill",
          description: "Example skill",
          source: "user",
          directory: "/home/user/.anima/skills",
        },
      ],
      total: 1,
    },
  }),
  skill_view: defineToolReturn({
    schema: z.object({ name: z.string(), content: z.string() }),
    example: {
      name: "my-skill",
      content: "---\ndescription: Example\n---\n\n# My Skill",
    },
  }),
  skill_delete: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      name: z.string(),
      message: z.string(),
    }),
    example: { ok: true, name: "my-skill", message: "Skill 'my-skill' deleted" },
  }),

  freeanima_docs_list: defineToolReturn({
    schema: z.object({
      docs: z.array(z.object({ path: z.string(), title: z.string() })),
      total: z.number(),
    }),
    example: {
      docs: [{ path: "product/architecture.md", title: "Architecture" }],
      total: 1,
    },
  }),
  freeanima_docs_get: defineToolReturn({
    schema: z.object({
      path: z.string(),
      title: z.string(),
      content: z.string(),
    }),
    example: {
      path: "product/architecture.md",
      title: "Architecture",
      content: "---\ntitle: Architecture\n---\n\n# FreeAnima Architecture\n",
    },
  }),
  freeanima_docs_search: defineToolReturn({
    schema: z.object({
      query: z.string(),
      hits: z.array(
        z.object({
          path: z.string(),
          title: z.string(),
          snippet: z.string(),
          matches: z.number(),
        }),
      ),
      total: z.number(),
    }),
    example: {
      query: "memory",
      hits: [
        {
          path: "cognition/memory.md",
          title: "Memory",
          snippet: "…semantic memory and FTS retrieval…",
          matches: 3,
        },
      ],
      total: 1,
    },
  }),

  conversation_search: defineToolReturn({
    schema: z.object({
      query: z.string(),
      hits: z.array(sessionSearchHitSchema),
      summary: z.string(),
    }),
    example: {
      query: "compression",
      hits: [
        {
          conversation_id: "sess-001",
          message_id: "msg-001",
          role: "user",
          timestamp: "2026-06-10T10:00:00+08:00",
          snippet: "…conversation compression…",
        },
      ],
      summary: "Found 1 historical conversation",
    },
  }),
  conversation_scroll: defineToolReturn({
    schema: z.object({
      conversation_id: z.string(),
      messages: z.array(sessionMessageRowSchema),
      total: z.number(),
      offset: z.number(),
      limit: z.number(),
    }),
    example: {
      conversation_id: "sess-001",
      messages: [
        {
          id: "msg-001",
          role: "user",
          content: "Hello",
          pos: 1,
          timestamp: "2026-06-10T10:00:00+08:00",
        },
      ],
      total: 1,
      offset: 0,
      limit: 20,
    },
  }),
  todo: defineToolReturn({
    schema: todoReturnSchema,
    example: {
      ok: true,
      todos: [
        {
          id: 1,
          content: "Tool return schema complete",
          status: "pending",
          created_at: "2026-06-10T10:00:00+08:00",
        },
      ],
      message: "Total 1 todo item",
    },
  }),
};
