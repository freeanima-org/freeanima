---
name: multi-worktree-workflow
description: >-
  Git 多 worktree 功能开发与合入流程：在副 worktree 隔离开发、在主 worktree
  cherry-pick 合入目标分支、清理临时分支与工作区。Use when using git worktree,
  cherry-pick integration, avoiding non-linear history, or cleaning up feature
  branches after merge to integration branch (e.g. 0.8).
---

# 多 Worktree 工作流

## 角色分工

| Worktree                                        | 用途                                               | 典型分支      |
| ----------------------------------------------- | -------------------------------------------------- | ------------- |
| **主 worktree**（如 `~/workspace/freeanima`）   | 集成线：checkout 目标分支，cherry-pick，push       | `0.8`、`main` |
| **副 worktree**（如 `~/.cursor/worktrees/...`） | 功能隔离：开发、commit，不 checkout 已被占用的分支 | `feat/...`    |

**硬约束**：同一分支只能在一个 worktree 中 checkout。副 worktree 不能 `git checkout 0.8` 若主 worktree 已占用。

## 0. 副 worktree：依赖安装（symlink node_modules）

每个 worktree 有独立工作目录，`bun install` 会从 cache 重建约 2G 的 `node_modules`，**首次约 9 分钟**；副 worktree 应复用主 worktree 已安装的依赖。

```bash
MAIN=/home/feng/workspace/freeanima   # 主 worktree 路径
WT=$(git rev-parse --show-toplevel)

cd "$WT"
rm -rf node_modules
ln -s "$MAIN/node_modules" node_modules

# 可选校验（失败可忽略，见下）
bun install --frozen-lockfile --ignore-scripts || true
```

| 场景 | 做法 |
| ---- | ---- |
| `bun.lock` 与主 worktree 一致 | symlink 后 `--frozen-lockfile` 约 **5 秒** 完成 |
| `bun.lock` 略有差异 | **仍可 symlink**；多数情况下现有依赖够用 |
| 缺包 / 依赖变更 | 仅在**主 worktree** 执行 `bun install`，所有 symlink 的副 worktree 同步受益 |

**硬约束**：副 worktree **不要**跑普通 `bun install`（无 `--frozen-lockfile`）——symlink 指向同一份物理目录，会修改主 worktree 的 `node_modules`。依赖变更只在主 worktree 安装。

## 1. 开工前：确认基准

```bash
git worktree list
git log -1 --oneline HEAD
git log -1 --oneline <目标分支>   # 如 0.8
```

若 `HEAD` 落后于目标分支，副 worktree 的 `git status` 会把「已在目标分支 commit 的改动」误显示为未提交。**先对齐再开发**：

```bash
# 副 worktree 对齐到目标分支 tip（不 checkout 分支名）
git fetch origin <目标分支>
git reset --hard <目标分支>
```

## 2. 副 worktree：功能开发

```bash
git checkout -b feat/<topic>
# 仅改本功能相关文件；commit 前用 git diff --stat <目标分支> 核对范围
git add <功能相关文件>
git commit -m "$(cat <<'EOF'
feat(scope): 简述

正文说明 why。
EOF
)"
```

记录功能 commit SHA：`git log -1 --format=%H`

## 3. 主 worktree：cherry-pick 合入（保持线性历史）

**禁止** `git merge feat/...` 合入集成线。在主 worktree：

```bash
cd <主-worktree路径>
git checkout <目标分支>          # 如 0.8
git pull --ff-only origin <目标分支>   # 如有远程
git cherry-pick <功能-commit-SHA>
git log --oneline -3             # 确认线性
# git push origin <目标分支>     # 用户明确要求时再 push
```

冲突时：解决 → `git cherry-pick --continue`；放弃 → `git cherry-pick --abort`。

## 4. 合入后：清理副 worktree 与临时分支

在主 worktree cherry-pick **成功** 后，于副 worktree 执行：

```bash
cd <副-worktree路径>
git reset --hard <目标分支>      # 对齐集成线 tip，丢弃已 cherry-pick 的重复 commit
git checkout --detach            # 脱离 feat 分支，以便删除
git branch -D feat/<topic>       # 删除本地临时分支
git stash list                   # 若有对齐过程中的 stash
git stash drop stash@{0}         # 确认无用后删除
git status --short               # 应为空
```

可选：移除不再需要的 worktree（**先**完成上述清理）：

```bash
cd <主-worktree路径>
git worktree remove <副-worktree路径>
```

## 5. 副 worktree 仅恢复部分文件（避免 stash 冲突）

若副 worktree 混有旧 WIP + 新功能，**不要**直接 `stash pop` 到已对齐的集成线。改为：

```bash
git reset --hard <目标分支>
git checkout stash@{0} -- <文件1> <文件2> ...   # 仅功能相关路径
# 未跟踪文件：
git show stash@{0}^3:<path> > <path>
git stash drop stash@{0}
```

## 检查清单

```
合入前：
- [ ] 副 worktree HEAD 基于最新目标分支
- [ ] git diff --stat <目标分支> 仅含本功能文件

合入：
- [ ] 主 worktree cherry-pick（非 merge）
- [ ] git log 线性、无 merge commit

合入后：
- [ ] 副 worktree reset 到目标分支 tip
- [ ] 删除 feat/<topic> 分支
- [ ] 清理 stash；git status 干净
```

## 反模式

- 在落后集成分支的副 worktree 上解读 `git status`（会把已合入的其他 work 算进来）
- 副 worktree `git checkout 0.8`（分支已被主 worktree 占用）
- 用 `merge` 合入功能分支到集成线（非线性历史）
- cherry-pick 后保留 `feat/` 分支与重复 commit 不清理
