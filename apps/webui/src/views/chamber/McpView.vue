<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div>
        <h2 class="text-lg font-bold">🔌 MCP</h2>
        <p class="text-sm text-base-content/60 mt-1">
          MCP 服务器配置与运行时状态（工具、资源、Prompt）。
        </p>
      </div>
      <div v-if="!loading && status.servers.length" class="flex gap-2">
        <button
          class="btn btn-sm btn-primary"
          :disabled="bulkActing"
          @click="controlAll('start-all')"
        >
          启动全部
        </button>
        <button
          class="btn btn-sm btn-outline"
          :disabled="bulkActing"
          @click="controlAll('stop-all')"
        >
          停止全部
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
            <p class="text-2xl font-mono">{{ status.server_count }}</p>
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
            <h3 class="text-sm text-base-content/60">连接中</h3>
            <p class="text-2xl font-mono">{{ status.connecting_count ?? 0 }}</p>
          </div>
        </div>
        <div class="card bg-base-200">
          <div class="card-body py-4">
            <h3 class="text-sm text-base-content/60">注册工具</h3>
            <p class="text-2xl font-mono">{{ status.tool_count }}</p>
          </div>
        </div>
      </div>

      <div v-if="status.servers.length === 0" class="alert alert-info text-sm">
        未配置 MCP 服务器。在 <code class="text-xs">~/.anima/config.yaml</code> 的
        <code class="text-xs">mcp_servers</code> 中添加。
      </div>

      <div v-for="srv in status.servers" :key="srv.name" class="card bg-base-200">
        <div class="card-body">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="font-mono font-bold">{{ srv.name }}</h3>
              <span class="badge badge-sm" :class="statusBadgeClass(srv.status)">
                {{ statusLabel(srv.status) }}
              </span>
              <span class="badge badge-ghost badge-sm">{{ srv.config.transport }}</span>
              <span v-if="!srv.config.enabled" class="badge badge-ghost badge-sm">enabled: false</span>
            </div>
            <div class="flex gap-2">
              <button
                v-if="canStart(srv)"
                class="btn btn-xs btn-primary"
                :disabled="!!acting[srv.name] || bulkActing"
                @click="controlServer(srv.name, 'start')"
              >
                <span v-if="acting[srv.name] === 'start'" class="loading loading-spinner loading-xs"></span>
                启动
              </button>
              <button
                v-if="canStop(srv)"
                class="btn btn-xs btn-outline"
                :disabled="!!acting[srv.name] || bulkActing"
                @click="controlServer(srv.name, 'stop')"
              >
                <span v-if="acting[srv.name] === 'stop'" class="loading loading-spinner loading-xs"></span>
                停止
              </button>
            </div>
          </div>

          <div v-if="srv.error" class="alert alert-error text-xs py-2 mb-3">
            {{ srv.error }}
          </div>

          <details open class="mb-3">
            <summary class="text-sm font-medium cursor-pointer mb-2">配置</summary>
            <table class="table table-xs">
              <tbody>
                <tr>
                  <td class="text-base-content/50 w-28">enabled</td>
                  <td class="font-mono">{{ srv.config.enabled ? 'true' : 'false' }}</td>
                </tr>
                <tr v-if="srv.config.command">
                  <td class="text-base-content/50">command</td>
                  <td class="font-mono">{{ srv.config.command }}</td>
                </tr>
                <tr v-if="srv.config.args?.length">
                  <td class="text-base-content/50">args</td>
                  <td class="font-mono">{{ srv.config.args.join(' ') }}</td>
                </tr>
                <tr v-if="srv.config.url">
                  <td class="text-base-content/50">url</td>
                  <td class="font-mono">{{ srv.config.url }}</td>
                </tr>
                <tr v-if="srv.config.cwd">
                  <td class="text-base-content/50">cwd</td>
                  <td class="font-mono">{{ srv.config.cwd }}</td>
                </tr>
                <tr v-if="srv.config.api_key_env">
                  <td class="text-base-content/50">api_key_env</td>
                  <td class="font-mono">{{ srv.config.api_key_env }}</td>
                </tr>
                <tr v-if="srv.config.connect_timeout_ms">
                  <td class="text-base-content/50">connect_timeout_ms</td>
                  <td class="font-mono">{{ srv.config.connect_timeout_ms }}</td>
                </tr>
                <tr v-if="srv.config.env_keys?.length">
                  <td class="text-base-content/50">env</td>
                  <td class="font-mono">{{ srv.config.env_keys.join(', ') }}</td>
                </tr>
              </tbody>
            </table>
          </details>

          <details class="mb-2">
            <summary class="text-sm font-medium cursor-pointer">
              工具 ({{ srv.tools.length }})
              <span v-if="srv.registered_tools.length !== srv.tools.length" class="text-base-content/50 font-normal">
                · 已注册 {{ srv.registered_tools.length }}
              </span>
            </summary>
            <div v-if="srv.tools.length === 0" class="text-xs text-base-content/50 mt-2">
              无工具或未连接
            </div>
            <div v-else class="mt-2 space-y-2">
              <div
                v-for="tool in srv.tools"
                :key="tool.registered_name"
                class="bg-base-300 rounded-lg px-3 py-2"
              >
                <div class="flex flex-wrap items-baseline gap-2">
                  <span class="font-mono text-xs font-bold">{{ tool.registered_name }}</span>
                  <span class="text-xs text-base-content/40">← {{ tool.original_name }}</span>
                </div>
                <p v-if="tool.description" class="text-xs text-base-content/60 mt-1">
                  {{ tool.description }}
                </p>
                <details class="mt-1">
                  <summary class="text-xs cursor-pointer text-base-content/50">inputSchema</summary>
                  <pre class="text-xs mt-1 overflow-x-auto">{{ JSON.stringify(tool.input_schema, null, 2) }}</pre>
                </details>
              </div>
            </div>
          </details>

          <details class="mb-2">
            <summary class="text-sm font-medium cursor-pointer">
              资源 ({{ srv.resources.length }})
            </summary>
            <div v-if="srv.resources.length === 0" class="text-xs text-base-content/50 mt-2">
              无资源或 Server 未声明 resources
            </div>
            <div v-else class="mt-2 overflow-x-auto">
              <table class="table table-xs">
                <thead>
                  <tr>
                    <th>URI</th>
                    <th>名称</th>
                    <th>MIME</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="res in srv.resources" :key="res.uri">
                    <td class="font-mono">{{ res.uri }}</td>
                    <td>{{ res.name || '—' }}</td>
                    <td class="text-base-content/50">{{ res.mime_type || '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>

          <details>
            <summary class="text-sm font-medium cursor-pointer">
              Prompts ({{ srv.prompts.length }})
            </summary>
            <div v-if="srv.prompts.length === 0" class="text-xs text-base-content/50 mt-2">
              无 Prompt 或 Server 未声明 prompts
            </div>
            <div v-else class="mt-2 space-y-2">
              <div
                v-for="prompt in srv.prompts"
                :key="prompt.name"
                class="bg-base-300 rounded-lg px-3 py-2"
              >
                <span class="font-mono text-xs font-bold">{{ prompt.name }}</span>
                <p v-if="prompt.description" class="text-xs text-base-content/60 mt-1">
                  {{ prompt.description }}
                </p>
                <div v-if="prompt.arguments?.length" class="mt-1 text-xs text-base-content/50">
                  参数：{{ prompt.arguments.map(a => a.name).join(', ') }}
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>

    <div v-if="error" class="alert alert-error text-sm mt-4">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getMcpStatus, mcpServerAction, mcpBulkAction } from '../../api/client'

const loading = ref(true)
const bulkActing = ref(false)
const acting = ref({})
const error = ref('')
const status = ref({
  server_count: 0,
  connected_count: 0,
  connecting_count: 0,
  tool_count: 0,
  servers: [],
})

function statusLabel(s) {
  if (s === 'connected') return '已连接'
  if (s === 'connecting') return '连接中'
  if (s === 'disabled') return '已禁用'
  if (s === 'error') return '错误'
  return '未启动'
}

function statusBadgeClass(s) {
  if (s === 'connected') return 'badge-success'
  if (s === 'connecting') return 'badge-warning'
  if (s === 'disabled') return 'badge-ghost'
  if (s === 'error') return 'badge-error'
  return 'badge-ghost'
}

function canStart(srv) {
  if (srv.config.enabled === false) return false
  return srv.status !== 'connected' && srv.status !== 'connecting'
}

function canStop(srv) {
  return srv.status === 'connected' || srv.status === 'connecting'
}

async function loadStatus() {
  status.value = (await getMcpStatus()) as typeof status.value
}

async function controlServer(name: string, action: 'start' | 'stop') {
  error.value = ''
  acting.value = { ...acting.value, [name]: action }
  try {
    status.value = (await mcpServerAction(name, action)) as typeof status.value
  } catch (e) {
    error.value = `${name} ${action === 'start' ? '启动' : '停止'}失败: ${e instanceof Error ? e.message : String(e)}`
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
    status.value = (await mcpBulkAction(action)) as typeof status.value
  } catch (e) {
    error.value = action === 'start-all' ? `全部启动失败: ${e instanceof Error ? e.message : String(e)}` : `全部停止失败: ${e instanceof Error ? e.message : String(e)}`
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
