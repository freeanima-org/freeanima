<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div>
        <h2 class="text-lg font-bold">⏰ 定时任务</h2>
        <p class="text-sm text-base-content/60 mt-1">
          查看调度任务、启用/暂停与手动触发。新建或删除请使用 <code class="text-xs">cronjob</code> 工具。
        </p>
      </div>
      <button class="btn btn-sm btn-ghost" :disabled="loading" @click="reload">
        刷新
      </button>
    </div>

    <div v-if="loading" class="flex justify-center py-8">
      <span class="loading loading-dots loading-md"></span>
    </div>

    <div v-else class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="card bg-base-200">
          <div class="card-body py-4">
            <h3 class="text-sm text-base-content/60">任务总数</h3>
            <p class="text-2xl font-mono">{{ jobs.length }}</p>
          </div>
        </div>
        <div class="card bg-base-200">
          <div class="card-body py-4">
            <h3 class="text-sm text-base-content/60">运行中</h3>
            <p class="text-2xl font-mono">{{ activeCount }}</p>
          </div>
        </div>
        <div class="card bg-base-200">
          <div class="card-body py-4">
            <h3 class="text-sm text-base-content/60">已暂停</h3>
            <p class="text-2xl font-mono">{{ pausedCount }}</p>
          </div>
        </div>
      </div>

      <div v-if="jobs.length === 0" class="alert alert-info text-sm">
        暂无定时任务。可通过 Agent 侧 <code class="text-xs">cronjob</code> 工具创建（例如
        <code class="text-xs">action=create</code>）。
      </div>

      <div v-for="job in jobs" :key="job.id" class="card bg-base-200">
        <div class="card-body">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="font-bold">{{ job.name }}</h3>
              <span class="badge badge-sm" :class="job.paused ? 'badge-ghost' : 'badge-success'">
                {{ job.paused ? '已暂停' : '运行中' }}
              </span>
              <span v-if="job.builtin" class="badge badge-ghost badge-sm">内置</span>
              <span v-if="job.no_agent" class="badge badge-ghost badge-sm">仅脚本</span>
            </div>
            <div class="flex flex-wrap items-center gap-3">
              <label class="label cursor-pointer gap-2 py-0">
                <span class="label-text text-xs">启用</span>
                <input
                  type="checkbox"
                  class="toggle toggle-sm toggle-primary"
                  :checked="!job.paused"
                  :disabled="!!toggling[job.id] || !!running[job.id]"
                  @change="onToggle(job, $event)"
                />
              </label>
              <button
                class="btn btn-xs btn-outline"
                :disabled="!!toggling[job.id] || !!running[job.id]"
                @click="runNow(job)"
              >
                <span v-if="running[job.id]" class="loading loading-spinner loading-xs"></span>
                立即运行
              </button>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="table table-xs">
              <tbody>
                <tr>
                  <td class="text-base-content/50 w-24">ID</td>
                  <td class="font-mono text-xs break-all">{{ job.id }}</td>
                </tr>
                <tr>
                  <td class="text-base-content/50">调度</td>
                  <td class="font-mono">{{ job.schedule }}</td>
                </tr>
                <tr>
                  <td class="text-base-content/50">运行次数</td>
                  <td>
                    {{ job.run_count }}{{ job.repeat != null ? ` / ${job.repeat}` : '' }}
                  </td>
                </tr>
                <tr>
                  <td class="text-base-content/50">上次运行</td>
                  <td>{{ formatTs(Number(job.last_run_at)) }}</td>
                </tr>
                <tr>
                  <td class="text-base-content/50">下次运行</td>
                  <td>{{ job.paused ? '—' : formatTs(Number(job.next_run_at)) }}</td>
                </tr>
                <tr v-if="job.deliver">
                  <td class="text-base-content/50">投递</td>
                  <td class="font-mono">{{ job.deliver }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <details class="mt-3">
            <summary class="text-sm font-medium cursor-pointer">详情</summary>
            <div class="mt-2 space-y-2 text-sm text-base-content/80">
              <p v-if="job.script">
                <span class="text-base-content/50">脚本：</span>
                <code class="text-xs">{{ job.script }}</code>
              </p>
              <p v-if="skillsLabel(job.skills)">
                <span class="text-base-content/50">技能：</span>
                {{ skillsLabel(job.skills) }}
              </p>
              <p v-if="job.prompt" class="whitespace-pre-wrap break-words">
                <span class="text-base-content/50">提示词：</span>{{ promptPreview(str(job.prompt)) }}
              </p>
              <p v-if="job.last_output" class="whitespace-pre-wrap break-words">
                <span class="text-base-content/50">最近输出：</span>{{ outputPreview(str(job.last_output)) }}
              </p>
              <p v-if="!job.prompt && !job.last_output && !job.script" class="text-base-content/50 text-xs">
                （无额外详情）
              </p>
            </div>
          </details>

          <p v-if="toast[job.id]" class="text-xs text-success mt-2">{{ toast[job.id] }}</p>
        </div>
      </div>
    </div>

    <div v-if="error" class="alert alert-error text-sm mt-4">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { listCronJobs, cronJobAction } from '../../api/client'

type CronJob = Record<string, unknown> & { id: string; name?: string; paused?: boolean }

const loading = ref(true)
const error = ref('')
const jobs = ref<CronJob[]>([])
const toggling = ref<Record<string, string>>({})
const running = ref<Record<string, boolean>>({})
const toast = ref<Record<string, string>>({})

const activeCount = computed(() => jobs.value.filter((j) => !j.paused).length)
const pausedCount = computed(() => jobs.value.filter((j) => j.paused).length)

function skillsLabel(skills: unknown) {
  return Array.isArray(skills) ? skills.map(String).join(', ') : ''
}

function str(v: unknown) {
  return v == null ? '' : String(v)
}
function formatTs(ts: number) {
  if (!ts || ts <= 0) return '—'
  const d = new Date(ts * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function promptPreview(text: string) {
  return text.length > 300 ? `${text.slice(0, 300)}…` : text
}

function outputPreview(text: string) {
  return text.length > 300 ? `${text.slice(0, 300)}…` : text
}

function updateJob(updated: CronJob) {
  const i = jobs.value.findIndex((j) => j.id === updated.id)
  if (i >= 0) jobs.value[i] = { ...jobs.value[i], ...updated }
}

async function loadJobs() {
  jobs.value = (await listCronJobs()) as CronJob[]
}

async function reload() {
  error.value = ''
  loading.value = true
  try {
    await loadJobs()
  } catch (e) {
    error.value = `加载失败: ${e instanceof Error ? e.message : String(e)}`
  } finally {
    loading.value = false
  }
}

async function onToggle(job: CronJob, event: Event) {
  const target = event.target as HTMLInputElement
  const enable = target.checked
  const action = enable ? 'resume' : 'pause'
  error.value = ''
  toggling.value = { ...toggling.value, [job.id]: action }
  try {
    const data = await cronJobAction(job.id, action)
    if (data.job) updateJob(data.job as CronJob)
  } catch (e) {
    target.checked = !enable
    error.value = `${job.name} ${enable ? '启用' : '暂停'}失败: ${e instanceof Error ? e.message : String(e)}`
  } finally {
    const next = { ...toggling.value }
    delete next[job.id]
    toggling.value = next
  }
}

async function runNow(job: CronJob) {
  error.value = ''
  running.value = { ...running.value, [job.id]: true }
  try {
    const data = await cronJobAction(job.id, 'run')
    if (data.job) updateJob(data.job as CronJob)
    toast.value = { ...toast.value, [job.id]: data.message || '已触发' }
    setTimeout(() => {
      const next = { ...toast.value }
      delete next[job.id]
      toast.value = next
    }, 4000)
    setTimeout(() => void loadJobs().catch(() => {}), 2000)
  } catch (e) {
    error.value = `${job.name} 触发失败: ${e instanceof Error ? e.message : String(e)}`
  } finally {
    const next = { ...running.value }
    delete next[job.id]
    running.value = next
  }
}

onMounted(async () => {
  try {
    await loadJobs()
  } catch (e) {
    error.value = `加载失败: ${e instanceof Error ? e.message : String(e)}`
  } finally {
    loading.value = false
  }
})
</script>
