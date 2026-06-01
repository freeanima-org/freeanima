<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div>
        <h2 class="text-lg font-bold">🤝 ACP</h2>
        <p class="text-sm text-base-content/60 mt-1">
          Agent Client Protocol 代理：配置、连接状态与逸灵风侧活跃 session。
        </p>
      </div>
      <div v-if="!loading && status.agents.length" class="flex gap-2">
        <button
          class="btn btn-sm btn-primary"
          :disabled="bulkActing"
          @click="controlAll('start-all')"
        >
          连接全部
        </button>
        <button
          class="btn btn-sm btn-outline"
          :disabled="bulkActing"
          @click="controlAll('stop-all')"
        >
          断开全部
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-8">
      <span class="loading loading-dots loading-md"></span>
    </div>

    <div v-else class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="card bg-base-200">
          <div class="card-body py-4">
            <h3 class="text-sm text-base-content/60">已配置</h3>
            <p class="text-2xl font-mono">{{ status.agent_count }}</p>
          </div>
        </div>
        <div class="card bg-base-200">
          <div class="card-body py-4">
            <h3 class="text-sm text-base-content/60">已连接</h3>
            <p class="text-2xl font-mono">{{ status.connected_count }}</p>
          </div>
        </div>
        <div class="card bg-base-200">
          <div class="card-body py-4">
            <h3 class="text-sm text-base-content/60">活跃 Session</h3>
            <p class="text-2xl font-mono">{{ status.session_count }}</p>
          </div>
        </div>
        <div class="card bg-base-200">
          <div class="card-body py-4">
            <h3 class="text-sm text-base-content/60">注册工具</h3>
            <p class="text-2xl font-mono">{{ status.tool_count }}</p>
          </div>
        </div>
      </div>

      <div v-if="status.agents.length === 0" class="alert alert-info text-sm">
        未配置 ACP Agent。在 <code class="text-xs">~/.anima/config.yaml</code> 的
        <code class="text-xs">acp_agents</code> 中添加（例如 Cursor：<code class="text-xs">agent acp</code>）。
      </div>

      <div v-for="agent in status.agents" :key="agent.name" class="card bg-base-200">
        <div class="card-body">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="font-mono font-bold">{{ agent.name }}</h3>
              <span class="badge badge-sm" :class="statusBadgeClass(agent.status)">
                {{ statusLabel(agent.status) }}
              </span>
              <span v-if="agent.tool" class="badge badge-ghost badge-sm font-mono">
                {{ agent.tool.name }}
              </span>
            </div>
            <div class="flex gap-2">
              <button
                v-if="canStart(agent)"
                class="btn btn-xs btn-primary"
                :disabled="!!acting[agent.name] || bulkActing"
                @click="controlAgent(agent.name, 'start')"
              >
                <span v-if="acting[agent.name] === 'start'" class="loading loading-spinner loading-xs"></span>
                连接
              </button>
              <button
                v-if="canStop(agent)"
                class="btn btn-xs btn-outline"
                :disabled="!!acting[agent.name] || bulkActing"
                @click="controlAgent(agent.name, 'stop')"
              >
                <span v-if="acting[agent.name] === 'stop'" class="loading loading-spinner loading-xs"></span>
                断开
              </button>
            </div>
          </div>

          <div v-if="agent.error" class="alert alert-error text-xs py-2 mb-3">
            {{ agent.error }}
          </div>

          <p v-if="agent.config.description" class="text-sm text-base-content/70 mb-3">
            {{ agent.config.description }}
          </p>

          <details open class="mb-3">
            <summary class="text-sm font-medium cursor-pointer mb-2">配置</summary>
            <table class="table table-xs">
              <tbody>
                <tr v-if="agent.config.enabled === false">
                  <td class="text-base-content/50 w-28">enabled</td>
                  <td class="font-mono">false</td>
                </tr>
                <tr v-if="agent.config.connect_timeout_ms">
                  <td class="text-base-content/50 w-28">connect_timeout_ms</td>
                  <td class="font-mono">{{ agent.config.connect_timeout_ms }}</td>
                </tr>
                <tr v-if="agent.config.prompt_timeout_ms">
                  <td class="text-base-content/50">prompt_timeout_ms</td>
                  <td class="font-mono">{{ agent.config.prompt_timeout_ms }}</td>
                </tr>
                <tr v-if="agent.config.adapter">
                  <td class="text-base-content/50 w-28">adapter</td>
                  <td class="font-mono">{{ agent.config.adapter }}</td>
                </tr>
                <tr v-if="agent.config.command">
                  <td class="text-base-content/50 w-28">command</td>
                  <td class="font-mono">{{ agent.config.command }}</td>
                </tr>
                <tr v-if="agent.config.args?.length">
                  <td class="text-base-content/50">args</td>
                  <td class="font-mono">{{ agent.config.args.join(' ') }}</td>
                </tr>
                <tr v-if="agent.config.cwd">
                  <td class="text-base-content/50">cwd</td>
                  <td class="font-mono">{{ agent.config.cwd }}</td>
                </tr>
                <tr v-if="agent.config.plan_mode !== undefined">
                  <td class="text-base-content/50">plan_mode</td>
                  <td class="font-mono">{{ formatPlanMode(agent.config.plan_mode) }}</td>
                </tr>
                <tr v-if="agent.config.agent_mode">
                  <td class="text-base-content/50">agent_mode</td>
                  <td class="font-mono">{{ agent.config.agent_mode }}</td>
                </tr>
              </tbody>
            </table>
          </details>

          <details v-if="agent.tool" class="mb-3">
            <summary class="text-sm font-medium cursor-pointer mb-2">注册工具</summary>
            <div class="bg-base-300 rounded-lg px-3 py-2 mt-2">
              <span class="font-mono text-xs font-bold">{{ agent.tool.name }}</span>
              <p class="text-xs text-base-content/60 mt-1">{{ agent.tool.description }}</p>
            </div>
          </details>

          <details>
            <summary class="text-sm font-medium cursor-pointer">
              活跃 Session ({{ agent.sessions.length }})
            </summary>
            <div v-if="agent.sessions.length === 0" class="text-xs text-base-content/50 mt-2">
              无。首次调用 <code class="text-xs">acp_{{ agent.name }}</code> 后会在此列出（断开 Agent 会清空）。
            </div>
            <div v-else class="mt-2 overflow-x-auto">
              <table class="table table-xs">
                <thead>
                  <tr>
                    <th>Session ID</th>
                    <th>完整 ID</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="sess in agent.sessions" :key="sess.session_id">
                    <td class="font-mono">{{ sess.session_id_short }}</td>
                    <td class="font-mono text-base-content/50 text-xs break-all">{{ sess.session_id }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </div>
    </div>

    <div class="alert alert-warning text-xs mt-6">
      <div>
        <p class="font-medium">说明</p>
        <ul class="list-disc list-inside mt-1 space-y-0.5 text-base-content/70">
          <li>逸灵风启动时会自动连接 <code class="text-xs">enabled !== false</code> 的 agent（与 MCP 一致）。</li>
          <li>「连接」仅完成 ACP <code class="text-xs">initialize</code> 握手，不创建 session。</li>
          <li>同一条逸灵风对话默认复用绑定的 ACP session；工具参数 <code class="text-xs">new_session: true</code> 可强制新开。</li>
          <li>实际任务由 Agent 通过 <code class="text-xs">acp_{name}</code> 触发；需本机已 <code class="text-xs">agent login</code>。</li>
          <li>断开 Agent 会终止子进程并清除进程内 session 登记（<code class="text-xs">session_meta.acp_sessions</code> 绑定仍保留，下次可尝试续用或重建）。</li>
        </ul>
      </div>
    </div>

    <div v-if="error" class="alert alert-error text-sm mt-4">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getAcpStatus, acpAgentAction, acpBulkAction } from '../../api/client'

const loading = ref(true)
const bulkActing = ref(false)
const acting = ref({})
const error = ref('')
const status = ref({
  agent_count: 0,
  connected_count: 0,
  session_count: 0,
  tool_count: 0,
  agents: [],
})

function statusLabel(s) {
  if (s === 'connected') return '已连接'
  if (s === 'starting') return '连接中'
  if (s === 'error') return '错误'
  if (s === 'disabled') return '已禁用'
  return '未连接'
}

function statusBadgeClass(s) {
  if (s === 'connected') return 'badge-success'
  if (s === 'starting') return 'badge-warning'
  if (s === 'error') return 'badge-error'
  if (s === 'disabled') return 'badge-ghost opacity-60'
  return 'badge-ghost'
}

function formatPlanMode(v) {
  if (v === false) return 'false（跳过 plan）'
  return String(v)
}

function canStart(agent) {
  return agent.status !== 'connected' && agent.status !== 'starting' && agent.status !== 'disabled'
}

function canStop(agent) {
  return agent.status === 'connected' || agent.status === 'starting'
}

async function loadStatus() {
  status.value = (await getAcpStatus()) as typeof status.value
}

async function controlAgent(name: string, action: 'start' | 'stop') {
  error.value = ''
  acting.value = { ...acting.value, [name]: action }
  try {
    status.value = (await acpAgentAction(name, action)) as typeof status.value
  } catch (e) {
    error.value = `${name} ${action === 'start' ? '连接' : '断开'}失败: ${e instanceof Error ? e.message : String(e)}`
  } finally {
    const next = { ...acting.value }
    delete next[name]
    acting.value = next
  }
}

async function controlAll(action: 'start-all' | 'stop-all') {
  error.value = ''
  bulkActing.value = true
  try {
    status.value = (await acpBulkAction(action)) as typeof status.value
  } catch (e) {
    error.value =
      action === 'start-all' ? `全部连接失败: ${e instanceof Error ? e.message : String(e)}` : `全部断开失败: ${e instanceof Error ? e.message : String(e)}`
  } finally {
    bulkActing.value = false
  }
}

onMounted(async () => {
  try {
    await loadStatus()
  } catch (e) {
    error.value = `加载失败: ${e.message}`
  } finally {
    loading.value = false
  }
})
</script>
