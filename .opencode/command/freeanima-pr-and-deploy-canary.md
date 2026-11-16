# /freeanima-pr-and-deploy-canary

FreeAnima：push → PR → CI 修到绿 → rebase 合并 → 盯 Canary → `feng.ecs` 升 canary。**Agent 细则见技能** [`freeanima-pr-and-deploy-canary`](../skills/freeanima-pr-and-deploy-canary/SKILL.md)。

## 快速路径（Agent）

1. **push**：工作区干净 → `git push -u origin HEAD`（禁 `--no-verify`）
2. **PR**：复用 open PR，否则 `gh pr create --base main`（见 `github-pr-create`）
3. **盯 PR CI**：`gh pr checks <n> --watch --fail-fast`；红则修 → commit → push → 再 watch
4. **合并**：`gh pr merge <n> --rebase --delete-branch=false`（仅 rebase）
5. **盯 Canary**：`gh run list --workflow=canary.yml --branch main --limit 1` → `gh run watch <id> --exit-status`；红则修到绿再往下
6. **生产升级**（固定）：
   ```bash
   ssh feng.ecs 'bash -lc "set -euo pipefail; source ~/.bashrc.local; pon; anima upgrade --channel canary; anima --version; anima service status"'
   ```
7. **汇报**：PR URL、Canary run URL、feng 版本串与 health

## 硬性规则

- 顺序：**push → PR → CI 绿 → rebase merge → Canary 绿 → feng 升级**
- 合并只许 **rebase**；禁 squash / merge commit；禁 force-push `main`
- 生产写死：`feng.ecs` + `source ~/.bashrc.local` + `pon` + `anima upgrade --channel canary`
- CI / Canary 红：**修到绿**再继续，不得跳过

## 命名对照

| 类型     | 名称                              | 用途                     |
| -------- | --------------------------------- | ------------------------ |
| **命令** | `/freeanima-pr-and-deploy-canary` | 用户聊天入口             |
| **技能** | `freeanima-pr-and-deploy-canary`  | Agent 完整流程与失败处理 |
