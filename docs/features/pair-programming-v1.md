---
title: Pair Programming V1
---

# Pair Programming v1 — Workbench Design

> **Phase 1 ✅ Implemented** (2026-05-29): three-column UI, highlight.js viewer, studio tree/file/search, xterm terminal, `studio-pair-programming` platform.
> API shape is **tRPC** (`connectors/webui/src/trpc/routers/studio.ts`), not REST examples below.

## Design Principles

- **Ship fast, not feature-complete:** Minimal viable scope to close the loop of "review code with Agent in Studio"
- **Lightweight start:** File tree + file viewer + global search + chat + terminal; no Monaco Editor yet
- **Syntax highlighting via highlight.js** (not Monaco Editor) to reduce first implementation cost
- **Read-only first:** v1 focuses on reading code; Agent analyzes and suggests, no direct edit/save yet
- **Platform identity separation:** Pair programming sessions use dedicated platform id, isolated from parlor chat sessions
- **Local direct read:** Files read server-side (not Probe); workspace path configured in chamber settings
- **Terminal in Phase 1** (promoted from original Phase 2)—important for debugging and ops

## Overall Layout

```
┌──────────────────────────────────────────────────────────┐
│  Studio                     [Pair Programming] [Novel] … │  ← StudioLayout sidebar
├──────────┬────────────────────────┬──────────────────────┤
│ 🔍 Search│                       │  💬 Session list      │
│ Files    │                       │  ┌──────────────────┐ │
│ ─────── │     Code viewer        │  │ session-001      │ │
│ src/     │    (highlight.js)      │  │ session-002      │ │
│   main.ts│                       │  │ session-003      │ │
│   utils/ │   Shows selected file  │  ├──────────────────┤ │
│   ...    │   syntax highlight,    │  │                  │ │
│          │   line numbers         │  │  Chat area        │ │
│ index.html│                      │  │  Agent: this code │ │
│ package.json│                    │  │  has a potential… │ │
│          │                       │  │                  │ │
│          │                       │  │  ┌──input──┐     │ │
│          │                       │  │  │         │     │ │
└──────────┴────────────────────────┴──────────────────────┘
   Left              Center                   Right
  file tree      highlight.js code viewer   session list + chat
```

### Three-Column Widths

| Column           | Default | Resizable      |
| ---------------- | ------- | -------------- |
| Left (file tree) | 260px   | Drag 180–400px |
| Center (editor)  | 1fr     | —              |
| Right (sessions) | 360px   | Drag 280–500px |

## I. Platform-Aware Sessions

### Change: Frontend API Client

```ts
// api/client.ts
export function createSession(platform = "parlor") {
  return postJSON("/sessions", { platform });
}

export function listSessions(platform?: string) {
  const q = platform ? `?platform=${encodeURIComponent(platform)}` : "";
  return getJSON(`/sessions${q}`).then((d) => d.sessions || []);
}
```

### Change: Backend HTTP Layer

```ts
// http-app.ts

// Create session — read platform from body
api.post("/sessions", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const platform = body.platform ?? PARLOR_PLATFORM;
  return c.json(service.createSession(platform));
});

// List sessions — optional platform filter
api.get("/sessions", (c) => {
  const platform = c.req.query("platform") ?? undefined;
  return c.json(service.listSessions(platform));
});
```

> Note: `conversation.ts` `newSession(platform)` and `listSessions(platform?)` already support platform; HTTP layer only needs passthrough.

### Pair Programming Platform Value

```
platform = "studio-pair-programming"
```

- Sessions created in PairProgrammingView automatically carry this platform
- Session list filtered accordingly—pair programming sessions only
- Isolated from parlor (`parlor`) and other platform sessions

## II. Code Viewer

v1 does not embed Monaco Editor; **highlight.js** for syntax highlighting to reduce first implementation cost.

### Dependencies

```json
{
  "dependencies": {
    "highlight.js": "^11.9.0"
  }
}
```

### Component Structure

```
PairProgrammingView.vue
├── FileTreePanel.vue          ← left column
├── CodeViewerPanel.vue       ← center (highlight.js)
├── SessionPanel.vue           ← right column
│   ├── SessionList.vue        ← session list (platform filter)
│   └── ChatPanel.vue          ← chat (shares SSE channel with parlor)
```

### CodeViewerPanel Responsibilities

- Accept `{ filePath, content, language }` props
- Render syntax highlighting with highlight.js
- Show line numbers
- Optional basic code folding (v1 can skip)
- Click line number to select/copy (later for "Agent, look at this line")

### Future Upgrade Path

When editing is needed, upgrade to Monaco Editor (read-only→editable); file tree and chat unchanged.

## III. File Tree

### Data Source

```
GET /api/studio/tree?path=<workspace>
```

Return structure:

```json
{
  "tree": [
    {
      "name": "src",
      "type": "directory",
      "children": [
        { "name": "main.ts", "type": "file", "size": 1234 },
        { "name": "utils", "type": "directory", "children": [...] }
      ]
    },
    {
      "name": "package.json",
      "type": "file",
      "size": 567
    }
  ]
}
```

### File Tree Component

- Recursive directory tree, expand/collapse
- Click file → load content to viewer
- Root from chamber config `workspace` (v1 can hardcode or read from config)

### Filename Search

```
Search box (top of left column)
├── Keyword → real-time filter tree nodes
├── Matching files/dirs highlighted/kept
├── Fuzzy match (fuse.js or simple includes)
└── Select result → auto scroll and expand path
```

### Workspace Configuration

New chamber config keys:

| key                | Type    | Default | Description                     |
| ------------------ | ------- | ------- | ------------------------------- |
| `studio.workspace` | string  | `""`    | Pair programming workspace path |
| `studio.gitignore` | boolean | `true`  | Filter file tree by .gitignore  |

If workspace unset on first visit, show guide prompt linking to chamber config page.

## IV. Global Search

### API

```
POST /api/studio/search
Body: { query: string, path: string }
Response: {
  results: [
    {
      "file": "src/main.ts",
      "line": 42,
      "column": 8,
      "content": "  const x = foo()",
      "match": "foo"
    }
  ]
}
```

### Implementation

- Backend recursively scans workspace directory
- Read `.gitignore`, apply gitignore rules
- Support nested `.gitignore` (subdirectory rules stack)
- Use ripgrep if available, else Node.js line-by-line search
- Scope: all plain text files (configurable include extensions)

### Frontend Interaction

- Global search entry at bottom of left column or top of center column
- Results: filename + line + matching line snippet
- Click result → jump to file + line in viewer

## V. New Backend APIs

| Method | Path                 | Description                        |
| ------ | -------------------- | ---------------------------------- |
| `GET`  | `/api/studio/tree`   | Workspace file tree                |
| `GET`  | `/api/studio/file`   | Read file content (query: `path`)  |
| `POST` | `/api/studio/search` | Global text search                 |
| `GET`  | `/api/studio/config` | Studio config (includes workspace) |
| `PUT`  | `/api/studio/config` | Update studio config               |

### File Read

```
GET /api/studio/file?path=src/main.ts
Response:
{
  "path": "src/main.ts",
  "content": "import { ... }",
  "language": "typescript",
  "size": 1234
}
```

Safety limits:

- Path must be under workspace directory
- Reject hidden files (leading `.`) unless `showHidden` config allows
- File size cap: 1MB (over limit returns notice)

## VI. Frontend Store and State

### New Store

```ts
// stores/studio/pair-programming.js
export const usePairProgrammingStore = defineStore('pair-programming', () => {
  const sessions = ref([])
  const currentSessionId = ref(null)
  const fileTree = ref([])
  const currentFile = ref(null)      // { path, content, language }
  const searchResults = ref([])
  const workspace = ref('')

  async function fetchSessions() { /* filter by platform */ }
  async function createSession() { /* platform = studio-pair-programming */ }
  async function fetchTree() { /* GET /api/studio/tree */ }
  async function openFile(path) { /* GET /api/studio/file */ }
  async function globalSearch(query) { /* POST /api/studio/search */ }

  return { ... }
})
```

## VII. Routing and Navigation

```
GET /studio/pair-programming → PairProgrammingView.vue
```

Route in place:

```ts
{
  path: '/studio/pair-programming',
  name: 'studio-pair-programming',
  component: () => import('../views/studio/PairProgrammingView.vue'),
}
```

StudioLayout sidebar keeps existing style; pair programming as first entry.

## VIII. Implementation Plan

### Phase 1

| Step | Content                                                | Estimate |
| ---- | ------------------------------------------------------ | -------- |
| 1.1  | API: POST/GET sessions support platform                | 2h       |
| 1.2  | API: studio/tree, studio/file, studio/search endpoints | 4h       |
| 1.3  | Frontend: three-column layout + FileTreePanel          | 3h       |
| 1.4  | Frontend: CodeViewerPanel (highlight.js)               | 1.5h     |
| 1.5  | Frontend: SessionPanel (session list + chat)           | 3h       |
| 1.6  | Frontend: filename search + navigation                 | 2h       |
| 1.7  | Frontend: global search UI + result navigation         | 2h       |
| 1.8  | Terminal panel (xterm.js)                              | 2h       |

### Phase 2 (Later)

- Upgrade highlight.js to Monaco Editor (editable)
- File edit + diff preview + apply/reject
- Git panel (diff/stage/commit)
- Multi-workspace support
- More collaboration features

---

> Design document · 2026-05-28  
> Status: **Phase 1 ✅ Implemented** (2026-05-29); Phase 2 see [Issue #37](https://github.com/freeanima-org/freeanima/issues/37)
