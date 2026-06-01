<template>
  <div>
    <h2 class="text-lg font-bold mb-4">📊 仪表盘</h2>

    <div v-if="loading" class="flex justify-center py-8">
      <span class="loading loading-dots loading-md"></span>
    </div>

    <div v-else class="space-y-6">
      <!-- 运行态 -->
      <section>
        <h3 class="text-sm font-semibold text-base-content/60 mb-2">运行态</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="card bg-base-200">
            <div class="card-body py-4">
              <h4 class="text-sm text-base-content/60">服务状态</h4>
              <div class="flex items-center gap-2 mt-1">
                <span class="badge" :class="runtimeStatus === 'running' ? 'badge-success' : 'badge-error'">
                  {{ runtimeStatus }}
                </span>
                <span class="text-xs text-base-content/50">{{ runtimeVersion }}</span>
              </div>
            </div>
          </div>
          <div class="card bg-base-200">
            <div class="card-body py-4">
              <h4 class="text-sm text-base-content/60">运行时长</h4>
              <p class="text-2xl font-mono mt-1">{{ uptime || '—' }}</p>
            </div>
          </div>
          <div class="card bg-base-200">
            <div class="card-body py-4">
              <h4 class="text-sm text-base-content/60">进程内存</h4>
              <p class="text-2xl font-mono mt-1">{{ processMemoryLabel }}</p>
            </div>
          </div>
          <div class="card bg-base-200">
            <div class="card-body py-4">
              <h4 class="text-sm text-base-content/60">当前模型</h4>
              <p class="text-lg font-mono mt-1 truncate" :title="modelName">{{ modelName }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 会话与工具 -->
      <section>
        <h3 class="text-sm font-semibold text-base-content/60 mb-2">会话与工具</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="card bg-base-200">
            <div class="card-body py-4">
              <h4 class="text-sm text-base-content/60">会话</h4>
              <p class="text-2xl font-mono mt-1">{{ sessionCount }}</p>
              <p class="text-xs text-base-content/50">全平台总计</p>
            </div>
          </div>
          <div class="card bg-base-200">
            <div class="card-body py-4">
              <h4 class="text-sm text-base-content/60">工具</h4>
              <p class="text-2xl font-mono mt-1">{{ toolCount }}</p>
              <p class="text-xs text-base-content/50">已注册</p>
            </div>
          </div>
          <div class="card bg-base-200">
            <div class="card-body py-4">
              <div class="flex items-center justify-between gap-2">
                <h4 class="text-sm text-base-content/60">定时任务</h4>
                <router-link to="/chamber/cron" class="text-xs link link-hover">管理</router-link>
              </div>
              <p class="text-2xl font-mono mt-1">{{ cronCount }}</p>
              <p class="text-xs text-base-content/50">{{ cronCount > 0 ? '已配置' : '无' }}</p>
            </div>
          </div>
          <div class="card bg-base-200">
            <div class="card-body py-4">
              <h4 class="text-sm text-base-content/60">Slash 命令</h4>
              <p class="text-2xl font-mono mt-1">{{ commandCount ?? '—' }}</p>
              <p class="text-xs text-base-content/50">全平台</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 记忆 -->
      <section>
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 class="text-sm font-semibold text-base-content/60">记忆</h3>
          <div class="flex gap-2 text-xs">
            <router-link to="/chamber/memory-files" class="link link-hover">记忆文件</router-link>
            <span class="text-base-content/30">·</span>
            <router-link to="/chamber/memory" class="link link-hover">记忆台</router-link>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="card bg-base-200">
            <div class="card-body py-4">
              <h4 class="text-sm text-base-content/60">记忆文件</h4>
              <p class="text-2xl font-mono mt-1">{{ memoryStats.files_count }}</p>
            </div>
          </div>
          <div class="card bg-base-200">
            <div class="card-body py-4">
              <h4 class="text-sm text-base-content/60">记忆文件体积</h4>
              <p class="text-2xl font-mono mt-1">{{ formatBytes(memoryStats.files_bytes) }}</p>
            </div>
          </div>
          <div class="card bg-base-200">
            <div class="card-body py-4">
              <h4 class="text-sm text-base-content/60">L3 事实</h4>
              <p class="text-2xl font-mono mt-1">{{ memoryStats.facts_count }}</p>
            </div>
          </div>
          <div class="card bg-base-200">
            <div class="card-body py-4">
              <h4 class="text-sm text-base-content/60">L2 索引</h4>
              <p class="text-2xl font-mono mt-1">{{ memoryStats.l2_index_rows }}</p>
              <p class="text-xs text-base-content/50">条消息</p>
            </div>
          </div>
        </div>
      </section>

      <!-- MCP -->
      <section>
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 class="text-sm font-semibold text-base-content/60">MCP</h3>
          <router-link to="/chamber/mcp" class="text-xs link link-hover">管理</router-link>
        </div>
        <div v-if="mcpError" class="alert alert-warning text-sm mb-2 py-2">{{ mcpError }}</div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="card bg-base-200">
            <div class="card-body py-4">
              <h4 class="text-sm text-base-content/60">已配置</h4>
              <p class="text-2xl font-mono mt-1">{{ mcp.server_count }}</p>
            </div>
          </div>
          <div class="card bg-base-200">
            <div class="card-body py-4">
              <h4 class="text-sm text-base-content/60">已连接</h4>
              <p class="text-2xl font-mono mt-1">{{ mcp.connected_count }}</p>
            </div>
          </div>
          <div class="card bg-base-200">
            <div class="card-body py-4">
              <h4 class="text-sm text-base-content/60">连接中</h4>
              <p class="text-2xl font-mono mt-1">{{ mcp.connecting_count }}</p>
            </div>
          </div>
          <div class="card bg-base-200">
            <div class="card-body py-4">
              <h4 class="text-sm text-base-content/60">注册工具</h4>
              <p class="text-2xl font-mono mt-1">{{ mcp.tool_count }}</p>
            </div>
          </div>
        </div>
        <p v-if="!mcpError && mcp.server_count === 0" class="text-xs text-base-content/50 mt-2">
          未配置 MCP 服务器。
        </p>
      </section>

      <!-- ACP -->
      <section>
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 class="text-sm font-semibold text-base-content/60">ACP</h3>
          <router-link to="/chamber/acp" class="text-xs link link-hover">管理</router-link>
        </div>
        <div v-if="acpError" class="alert alert-warning text-sm mb-2 py-2">{{ acpError }}</div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="card bg-base-200">
            <div class="card-body py-4">
              <h4 class="text-sm text-base-content/60">已配置</h4>
              <p class="text-2xl font-mono mt-1">{{ acp.agent_count }}</p>
            </div>
          </div>
          <div class="card bg-base-200">
            <div class="card-body py-4">
              <h4 class="text-sm text-base-content/60">已连接</h4>
              <p class="text-2xl font-mono mt-1">{{ acp.connected_count }}</p>
            </div>
          </div>
          <div class="card bg-base-200">
            <div class="card-body py-4">
              <h4 class="text-sm text-base-content/60">活跃 Session</h4>
              <p class="text-2xl font-mono mt-1">{{ acp.session_count }}</p>
            </div>
          </div>
          <div class="card bg-base-200">
            <div class="card-body py-4">
              <h4 class="text-sm text-base-content/60">注册工具</h4>
              <p class="text-2xl font-mono mt-1">{{ acp.tool_count }}</p>
            </div>
          </div>
        </div>
        <p v-if="!acpError && acp.agent_count === 0" class="text-xs text-base-content/50 mt-2">
          未配置 ACP Agent。
        </p>
      </section>

      <!-- 会话按平台 -->
      <div class="card bg-base-200">
        <div class="card-body">
          <h3 class="card-title text-sm">会话按平台</h3>
          <div v-if="sessionPlatformRows.length === 0" class="text-sm text-base-content/50 mt-1">无会话</div>
          <div v-else class="flex flex-wrap gap-2 mt-2">
            <span
              v-for="row in sessionPlatformRows"
              :key="row.platform"
              class="badge badge-ghost badge-lg font-mono"
            >
              {{ row.platform }}: {{ row.count }}
            </span>
          </div>
        </div>
      </div>

      <!-- 平台连接 -->
      <div class="card bg-base-200">
        <div class="card-body">
          <h3 class="card-title text-sm">平台连接</h3>
          <div v-if="Object.keys(platforms).length === 0" class="text-sm text-base-content/50 mt-1">无平台接入</div>
          <div v-else class="mt-2 space-y-1">
            <div v-for="(ps, name) in platforms" :key="name" class="flex items-center gap-2 text-sm">
              <span
                class="badge"
                :class="[ps.status === 'connected' ? 'badge-success' : 'badge-ghost', 'badge-xs']"
              ></span>
              <span>{{ name }}</span>
              <span v-if="ps.bot_name" class="text-xs text-base-content/50">({{ ps.bot_name }})</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 系统 -->
      <div class="card bg-base-200">
        <div class="card-body">
          <h3 class="card-title text-sm">系统</h3>
          <div class="text-sm space-y-1 mt-1">
            <p>逸灵风 {{ runtimeLabel }}</p>
            <p v-if="startTimeIso" class="text-xs text-base-content/50">启动于 {{ startTimeIso }}</p>
            <p v-if="pid" class="text-xs text-base-content/50">PID {{ pid }}</p>
          <div class="mt-3 pt-3 border-t border-base-300">
            <button
              class="btn btn-outline btn-warning btn-sm"
              :disabled="restarting"
              @click="confirmRestart"
            >
              {{ restarting ? '重启中…' : '重启服务' }}
            </button>
          </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="error" class="alert alert-error text-sm mt-4">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  getStatus,
  getMcpStatus,
  getAcpStatus,
  listCommands,
  getTools,
  listCronJobs,
  restartService,
} from '../../api/client'
import type { ServiceStatus } from '@freeanima/api'

const loading = ref(true)
const error = ref('')
const mcpError = ref('')
const acpError = ref('')
const restarting = ref(false)

const runtimeStatus = ref('检查中...')
const runtimeVersion = ref('')
const runtimeLabel = ref('')
const uptime = ref('')
const processMemoryKb = ref(0)
const modelName = ref('—')
const startTimeIso = ref('')
const pid = ref<number | null>(null)

const sessionCount = ref(0)
const sessionByPlatform = ref<Record<string, number>>({})
const toolCount = ref(0)
const cronCount = ref(0)
const commandCount = ref<number | null>(null)

const memoryStats = ref({
  files_count: 0,
  files_bytes: 0,
  facts_count: 0,
  l2_index_rows: 0,
})

const mcp = ref({
  server_count: 0,
  connected_count: 0,
  connecting_count: 0,
  tool_count: 0,
})

const acp = ref({
  agent_count: 0,
  connected_count: 0,
  session_count: 0,
  tool_count: 0,
})

const platforms = ref<Record<string, { status?: string; bot_name?: string }>>({})

const processMemoryLabel = computed(() => {
  if (!processMemoryKb.value) return '—'
  const mb = processMemoryKb.value / 1024
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${processMemoryKb.value} KB`
})

const sessionPlatformRows = computed(() =>
  Object.entries(sessionByPlatform.value)
    .map(([platform, count]) => ({ platform, count }))
    .sort((a, b) => b.count - a.count),
)

function formatUptime(seconds: number | null | undefined) {
  if (!seconds) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function confirmRestart() {
  if (!confirm('确定要重启服务吗？正在进行的对话将被中断。')) return
  restarting.value = true
  restartService()
    .then((res) => {
      alert(res.message || '服务正在重启...')
    })
    .catch((err) => {
      alert('重启失败: ' + err.message)
      restarting.value = false
    })
}

function applyStatus(status: ServiceStatus | null) {
  if (!status) {
    error.value = '加载服务状态失败'
    return
  }
  runtimeStatus.value = status.status || 'unknown'
  runtimeVersion.value = `v${status.version || '?'}`
  runtimeLabel.value = `v${status.version || '?'}`
  pid.value = status.pid ?? null
  startTimeIso.value = status.start_time_iso || ''
  uptime.value = formatUptime(status.uptime_seconds)
  processMemoryKb.value = status.memory_kb ?? 0
  modelName.value = status.config?.model || '—'

  sessionCount.value = status.sessions?.total ?? 0
  sessionByPlatform.value = status.sessions?.by_platform ?? {}
  toolCount.value = status.tools ?? 0
  cronCount.value = status.cron_jobs ?? 0
  platforms.value = status.platforms || {}

  if (status.memory) {
    memoryStats.value = {
      files_count: status.memory.files_count ?? 0,
      files_bytes: status.memory.files_bytes ?? 0,
      facts_count: status.memory.facts_count ?? 0,
      l2_index_rows: status.memory.l2_index_rows ?? 0,
    }
  }
}

onMounted(async () => {
  const [status, mcpData, acpData, cmdData] = await Promise.all([
    getStatus(),
    getMcpStatus().catch(() => null),
    getAcpStatus().catch(() => null),
    listCommands({ all: true }).then((commands) => ({ commands })).catch(() => null),
  ])

  applyStatus(status as ServiceStatus | null)

  if (mcpData) {
    const d = mcpData as Record<string, number>
    mcp.value = {
      server_count: d.server_count ?? 0,
      connected_count: d.connected_count ?? 0,
      connecting_count: d.connecting_count ?? 0,
      tool_count: d.tool_count ?? 0,
    }
  } else {
    mcpError.value = 'MCP 状态加载失败'
  }

  if (acpData) {
    const d = acpData as Record<string, number>
    acp.value = {
      agent_count: d.agent_count ?? 0,
      connected_count: d.connected_count ?? 0,
      session_count: d.session_count ?? 0,
      tool_count: d.tool_count ?? 0,
    }
  } else {
    acpError.value = 'ACP 状态加载失败'
  }

  if (cmdData && 'commands' in cmdData && Array.isArray(cmdData.commands)) {
    commandCount.value = cmdData.commands.length
  }

  if (!toolCount.value) {
    try {
      const tools = await getTools()
      toolCount.value = tools.length
    } catch {
      /* ignore */
    }
  }

  if (!cronCount.value) {
    try {
      const jobs = await listCronJobs()
      cronCount.value = jobs.length
    } catch {
      /* ignore */
    }
  }

  loading.value = false
})
</script>
