# just i18n …
import '_common.just'

[no-cd]
check: _deps
  {{ bun }} scripts/check-docs-i18n.ts
  {{ bun }} scripts/check-po-health.ts --strict
  {{ bun }} scripts/check-paraglide-messages.ts
  {{ bun }} scripts/check-generated-docs-i18n.ts

[no-cd]
po4a: _deps
  {{ bun }} scripts/i18n-po4a.ts

[no-cd]
messages-master: _deps
  {{ bun }} scripts/gen-messages-po4a-master.ts

[no-cd]
messages-compile: _deps
  {{ bun }} scripts/compile-messages-from-po4a.ts

[no-cd]
paraglide: _deps
  {{ bun }} scripts/paraglide-compile.ts

# 一次性 / 维护
[no-cd]
messages-bootstrap-po: _deps
  {{ bun }} scripts/bootstrap-messages-po.ts

[no-cd]
docs-cfg: _deps
  {{ bun }} scripts/gen-po4a-cfg.ts

[no-cd]
docs-migrate-layout: _deps
  {{ bun }} scripts/migrate-docs-po-layout.ts

[no-cd]
docs-check: _deps
  {{ bun }} scripts/check-docs-i18n.ts

[no-cd]
docs-generated-check: _deps
  {{ bun }} scripts/check-generated-docs-i18n.ts

[no-cd]
docs-english-check: _deps
  {{ bun }} scripts/check-po-english-msgstr.ts

[no-cd]
po-health: _deps
  {{ bun }} scripts/check-po-health.ts

[no-cd]
po-health-strict: _deps
  {{ bun }} scripts/check-po-health.ts --strict
