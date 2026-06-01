# 需求：升级 remember 工具 + WebUI 重启按钮

## 任务 1：升级 remember 工具支持增删改（CUD）

### 背景
- `remember` 工具目前只支持创建事实（create）
- 底层 `MemoryStore`（`packages/memory/src/store.ts`）已支持完整的 CRUD（create/get/update/delete）
- `l3-indexer.ts` 的 `indexOne()` 函数已支持 DELETE + INSERT 模式（先删后插），但缺少单独的删除函数
- `recall` 返回结果中已包含 Fact ID（如 `f-000001-a1b2`）

### 需要修改的文件

#### 1. `packages/memory/src/l3-indexer.ts`
- 新增 `removeL3Fact(factId: string): boolean` 函数，从 FTS 和 meta 表中删除指定 fact

#### 2. `packages/tools/src/memory-tools.ts`
- `remember` 工具增加参数：
  - `action`: 可选字符串，默认 `"create"`，枚举值 `["create", "update", "delete"]`
  - `fact_id`: 可选字符串，`action=update` 或 `action=delete` 时必需
- 更新 tool description 描述新的增删改能力
- handler 根据 action 分发：
  - `create`（默认）：现有行为，store.create() + indexL3Fact()
  - `update`：store.get(fact_id) → 合并参数 → store.update() → indexL3Fact() 重新索引
  - `delete`：store.delete(fact_id) + removeL3Fact(fact_id)

### 需要导出的函数
- `@freeanima/memory` 需要导出 `removeL3Fact`（在 `packages/memory/src/index.ts` 中添加导出）
- `@freeanima/core` 需要重新导出（它 re-exports `@freeanima/memory`）

## 任务 2：WebUI 卧室仪表盘增加重启服务按钮

### 背景
- `serve.ts` 已完整实现 SIGTERM/SIGINT 优雅关停逻辑
- 可通过向自身发送 SIGTERM 信号触发该关停流程
- 系统进程管理器（systemd/Docker）会自动重启进程

### 需要修改的文件

#### 1. `packages/server/src/api-routes.ts`
- 新增 `POST /service/restart` 路由
- handler 先返回 `{ ok: true, message: "服务正在重启..." }`
- 延迟 100ms 后向自身发送 SIGTERM：`process.kill(process.pid, 'SIGTERM')`

#### 2. `apps/webui/src/api/client.ts`
- 新增 `restartService(): Promise<{ ok: boolean; message: string }>` 函数
- 调用 `POST /api/service/restart`

#### 3. `apps/webui/src/views/chamber/DashboardView.vue`
- 在「系统」卡片中增加一个"重启服务"按钮
- 点击后弹出确认对话框（确认后调用 restartService API）
- 请求成功后显示"重启中…"状态提示

## 实现顺序
1. 先改 l3-indexer.ts（新增 removeL3Fact）
2. 再改 memory-tools.ts（升级 remember）
3. 再改 memory/src/index.ts 和 core（导出）
4. 再改 api-routes.ts（新增重启路由）
5. 再改 client.ts（新增 API 调用）
6. 最后改 DashboardView.vue（新增按钮）
