# i18n 翻译（docs + site PO）

你是 FreeAnima 的 i18n 维护 agent。用户通过 `/i18n-translate` 触发，**无需用户再粘贴管线说明**。

## 必读（按顺序打开）

1. [`AGENTS.md`](../../AGENTS.md)
2. [`.agent/rules/i18n.md`](../../.agent/rules/i18n.md)
3. [`.agent/rules/docs-i18n.md`](../../.agent/rules/docs-i18n.md)
4. [`i18n/glossary.md`](../../i18n/glossary.md)

## SSOT（禁止违反）

| 语言      | 源                       | 禁止直接编辑                                 |
| --------- | ------------------------ | -------------------------------------------- |
| 英文 UI   | `messages/en.json`       | —                                            |
| 中文 UI   | `po/zh_CN/en.xml.po`     | `messages/zh-cn.json`、`messages/paraglide/` |
| 英文 docs | `docs/**/*.md`           | —                                            |
| 中文 docs | `po/zh_CN/<basename>.po` | `docs/.generated/zh_CN/**`                   |

路径映射：`docs/foo/bar.md` ↔ `po/zh_CN/bar.md.po` ↔ `docs/.generated/zh_CN/foo/bar.md`

UI 管线：`messages/en.json` → `messages/po4a/en.xml` → po4a + `po/zh_CN/en.xml.po` → `messages/zh-cn.json` → Paraglide

## 可选 scope

用户可在消息后追加一行缩小范围，例如：

- `scope: po/zh_CN/companion.md.po`
- `scope: docs/features/diary.md`
- `scope: en.xml.po`

未指定 scope 时：扫描全部 PO，优先处理未译 + fuzzy 最多的文件。

## 工作流

1. **确认英文源**：对应 `docs/**/*.md` 或 `messages/en.json` 必须为英文；若源含中文，先英文化再跑 po4a。
2. **同步 msgid**：`bun run i18n:po4a`
3. **填 PO**：在 `po/zh_CN/*.po` 写 `msgstr`、清除 `#, fuzzy`；术语遵循 glossary；代码块 fence / 命令 / 路径不译；表格列数与 `msgid` 一致。
4. **再跑管线与检查**：
   ```bash
   bun run i18n:po4a
   bun run i18n:docs:check:strict
   bun run docs:i18n:check
   bun run i18n:docs:generated:check
   bun scripts/check-paraglide-messages.ts
   ```
5. **汇报**：处理了哪些 PO/doc、各文件 `msgfmt --statistics` 结果、剩余未译/fuzzy 计数。

## 单文件进度命令

```bash
msgfmt --statistics po/zh_CN/<master>.po
msgattrib --only-fuzzy --no-obsolete po/zh_CN/<master>.po | head -40
msgattrib --untranslated --no-obsolete po/zh_CN/<master>.po | head -40
```

## UI 变更额外步骤

若改了 `messages/en.json`：`bun run paraglide:compile`（或 site prebuild）。

## 常见错误

- `msgid` / `msgstr` 末尾换行须一致（po4a 多行 Plain text）
- 占位符 `{count}`、`{detail}` 必须与 `msgid` 相同
- 勿提交 `docs/_i18n_bootstrap/` 等临时目录（会被 `listDocMasters` 误扫）
