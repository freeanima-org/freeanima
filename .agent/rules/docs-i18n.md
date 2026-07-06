# Docs i18n (AI agent rules)

> **PAUSED（文档站翻译维护）**：改 `docs/**/*.md` 时**仅维护英文**；**不必**填 `po/zh_CN/*.po`。`po/` 中现有译文冻结保留；`docs/.generated/zh_CN/` 由 `i18n:po4a` 在构建时生成，**不入库**（见 `.gitignore`）。恢复流程见 [`i18n.md`](i18n.md)。
>
> Pipeline overview: [`i18n.md`](i18n.md). Terminology: [`i18n/glossary.md`](../../i18n/glossary.md).

## When to read

- Editing [`docs/**/*.md`](../../docs/)
- Filling [`po/zh_CN/*.po`](../../po/zh_CN/) or [`po/zh_CN/en.xml.po`](../../po/zh_CN/en.xml.po)

## Docs authoring (English SSOT)

po4a uses **text + markdown** options (`markdown`, `yfm_keys=title`, `yfm_lenient`) — see [`po4a.cfg`](../../po4a.cfg).

| Rule                                                                                             | Why                                           |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| YAML frontmatter: only `title:` between opening/closing `---`                                    | Only `title` is extracted for translation     |
| Section dividers: `---` or `***` on its own line (oxfmt normalizes to `---`; po4a `yfm_lenient`) | Compatible with formatter + po4a              |
| Fenced code blocks: always include language tag (`bash`, `yaml`, `mermaid`, …)                   | Correct `Fenced code block (lang)` PO entries |
| Mermaid / ASCII diagram nodes: English identifiers                                               | Blocks usually stay identical in `msgstr`     |
| Wide markdown tables: ≤6 columns; prefer lists for comparisons                                   | Avoid fragile whole-table `msgid`             |
| API names, paths, commands: backticks; explanatory prose in separate sentences                   | Shorter translatable segments                 |
| No complex HTML or MDX in `docs/`                                                                | Starlight collection is plain Markdown        |

Run `bun run docs:i18n:check` before PR when touching docs **only after docs i18n is resumed** (currently paused).

## PO workflow (paused — do not run on routine doc edits)

## PO / Chinese msgstr

| Rule                                                                                                          | Why                                |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Same PR as English doc changes: update matching `po/zh_CN/<basename>.po`                                      | No human backfill                  |
| Follow [`i18n/glossary.md`](../../i18n/glossary.md) for product terms                                         | Consistent zh copy                 |
| `Fenced code block`: keep fences and info string; do not translate commands/paths; comments may be translated | Prevents broken generated markdown |
| `Plain text` / `Title #` / frontmatter: translate; keep `{placeholders}` and URLs                             | po4a / Paraglide parity            |
| Table `msgstr`: same column count and `\|` layout as `msgid`                                                  | Table integrity                    |
| Never hand-edit `docs/.generated/`, `messages/zh-cn.json`, `messages/paraglide/`                              | Generated artifacts                |

## Agent workflow

1. Edit English in `docs/` (and `messages/en.json` for UI strings).
2. Run `bun run i18n:po4a` — updates POT/PO stubs.
3. Fill empty/fuzzy `msgstr` in the relevant PO file(s).
4. Run `bun run i18n:po4a` again → `bun run i18n:docs:check` → `bun run docs:i18n:check` → `bun run i18n:docs:generated:check`.
5. UI changes: `bun run paraglide:compile` and `bun scripts/check-paraglide-messages.ts`.
