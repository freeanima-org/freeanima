<template>
  <div>
    <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-lg font-bold">🧠 记忆台</h2>
        <p class="text-sm text-base-content/60 mt-1">
          调试 <code class="text-xs">recall</code> 召回效果：L3 事实 FTS + L2 历史对话 FTS。
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="btn btn-sm btn-outline btn-warning"
          :disabled="busy"
          @click="runL2Distill"
        >
          <span v-if="busyAction === 'l2-distill'" class="loading loading-spinner loading-xs"></span>
          L2 蒸馏
        </button>
        <button
          type="button"
          class="btn btn-sm btn-outline"
          :disabled="busy"
          @click="runL2Reindex"
        >
          <span v-if="busyAction === 'l2-reindex'" class="loading loading-spinner loading-xs"></span>
          重建 L2 索引
        </button>
        <button
          type="button"
          class="btn btn-sm btn-outline"
          :disabled="busy"
          @click="runL3Reindex"
        >
          <span v-if="busyAction === 'l3-reindex'" class="loading loading-spinner loading-xs"></span>
          重建 L3 索引
        </button>
      </div>
    </div>

    <div v-if="statusMessage" class="alert alert-success text-sm mb-4">{{ statusMessage }}</div>

    <form class="card bg-base-200 mb-4" @submit.prevent="runSearch">
      <div class="card-body gap-4">
        <div class="form-control">
          <label class="label py-0">
            <span class="label-text text-xs">搜索词</span>
          </label>
          <input
            v-model="query"
            type="text"
            class="input input-bordered input-sm font-mono"
            placeholder="输入关键词…"
            autofocus
          />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="form-control">
            <label class="label py-0">
              <span class="label-text text-xs">L3 条数</span>
            </label>
            <input
              v-model.number="limit"
              type="number"
              min="1"
              max="50"
              class="input input-bordered input-sm"
            />
          </div>
          <div class="form-control">
            <label class="label py-0">
              <span class="label-text text-xs">L2 条数</span>
            </label>
            <input
              v-model.number="sessionLimit"
              type="number"
              min="1"
              max="50"
              class="input input-bordered input-sm"
            />
          </div>
          <div class="form-control">
            <label class="label py-0">
              <span class="label-text text-xs">L2 session 过滤（可选）</span>
            </label>
            <input
              v-model="sessionFilter"
              type="text"
              class="input input-bordered input-sm font-mono"
              placeholder="session id"
            />
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button type="submit" class="btn btn-sm btn-primary" :disabled="searching || !query.trim()">
            <span v-if="searching" class="loading loading-spinner loading-xs"></span>
            检索
          </button>
          <span v-if="searched && !searching" class="text-xs text-base-content/50">
            「{{ lastQuery }}」— L3 {{ result.l3.length }} 条，L2 {{ result.l2.length }} 条
          </span>
        </div>
      </div>
    </form>

    <div v-if="error" class="alert alert-error text-sm mb-4">{{ error }}</div>

    <div v-if="searched && !searching && isEmpty" class="alert alert-info text-sm">
      未找到与「{{ lastQuery }}」匹配的事实或历史对话（L2 仅含已蒸馏并索引的 session）。
    </div>

    <div v-if="searched && !isEmpty" class="space-y-4">
      <section v-if="result.l3.length">
        <h3 class="text-sm font-bold mb-2">
          L3 事实
          <span class="badge badge-ghost badge-sm ml-1">{{ result.l3.length }}</span>
        </h3>
        <div class="space-y-2">
          <div
            v-for="(hit, idx) in result.l3"
            :key="hit.fact_id"
            class="card bg-base-200"
          >
            <div class="card-body py-3 px-4 gap-2">
              <div class="flex flex-wrap items-center gap-2 text-xs">
                <span class="font-mono font-bold">{{ idx + 1 }}. {{ hit.fact_id }}</span>
                <span class="badge badge-ghost badge-xs">rank {{ Number(hit.rank).toFixed(4) }}</span>
                <span class="badge badge-primary badge-xs">score {{ Number(hit.score).toFixed(3) }}</span>
                <span class="badge badge-outline badge-xs">{{ hit.type }}</span>
                <span class="badge badge-ghost badge-xs">
                  置信 {{ pct(hit.confidence) }} / 重要 {{ pct(hit.importance) }} / 召回 {{ pct(hit.recall) }}
                </span>
              </div>
              <p class="text-sm whitespace-pre-wrap">{{ hit.content }}</p>
              <div v-if="hit.domains?.length" class="text-xs text-base-content/60">
                领域: {{ hit.domains.join(', ') }}
              </div>
              <div v-if="hit.entities?.length" class="text-xs text-base-content/60">
                实体: {{ hit.entities.join(', ') }}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section v-if="result.l2.length">
        <h3 class="text-sm font-bold mb-2">
          L2 历史对话
          <span class="badge badge-ghost badge-sm ml-1">{{ result.l2.length }}</span>
        </h3>
        <div class="space-y-2">
          <div
            v-for="(hit, idx) in result.l2"
            :key="`${hit.session_id}-${hit.timestamp}-${idx}`"
            class="card bg-base-200"
          >
            <div class="card-body py-3 px-4 gap-2">
              <div class="flex flex-wrap items-center gap-2 text-xs">
                <span class="font-mono font-bold">{{ idx + 1 }}.</span>
                <span class="badge badge-ghost badge-xs" :title="hit.session_id">
                  {{ hit.session_id.slice(0, 16) }}…
                </span>
                <span class="badge badge-secondary badge-xs">{{ hit.role }}</span>
                <span class="badge badge-ghost badge-xs">{{ hit.timestamp.slice(0, 19) || '?' }}</span>
                <span class="badge badge-ghost badge-xs">rank {{ Number(hit.rank).toFixed(4) }}</span>
                <span class="badge badge-primary badge-xs">score {{ Number(hit.score).toFixed(3) }}</span>
              </div>
              <p class="text-sm whitespace-pre-wrap">{{ hit.content }}</p>
            </div>
          </div>
        </div>
      </section>

      <details class="collapse collapse-arrow bg-base-200">
        <summary class="collapse-title text-xs font-mono text-base-content/60 min-h-0 py-3">
          recall 原始输出预览
        </summary>
        <div class="collapse-content">
          <pre class="text-xs bg-base-300 p-3 rounded-lg whitespace-pre-wrap overflow-x-auto">{{ toolPreview }}</pre>
        </div>
      </details>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { memorySearch, memoryAction, type MemoryAction } from '../../api/client'

const query = ref('')
const limit = ref(5)
const sessionLimit = ref(10)
const sessionFilter = ref('')
const searching = ref(false)
const busy = ref(false)
const busyAction = ref('')
const statusMessage = ref('')
const searched = ref(false)
const error = ref('')
const lastQuery = ref('')
const result = ref<{ query: string; l3: any[]; l2: any[] }>({ query: '', l3: [], l2: [] })

const isEmpty = computed(() => !result.value.l3.length && !result.value.l2.length)

const toolPreview = computed(() => formatToolOutput(result.value))

function pct(n) {
  return `${Math.round(Number(n ?? 0) * 100)}%`
}

function formatToolOutput(data) {
  const sections = []
  if (data.l3?.length) {
    const lines = [`找到 ${data.l3.length} 条匹配事实：`]
    for (const r of data.l3) {
      lines.push(
        `  [${r.fact_id}] (${pct(r.confidence)}/ ${pct(r.importance)}/ ${pct(r.recall)}) ${r.content}`,
      )
      if (r.domains?.length) lines.push(`       领域: ${r.domains.join(', ')}`)
    }
    sections.push(`## L3 事实\n${lines.join('\n')}`)
  }
  if (data.l2?.length) {
    const lines = [`找到 ${data.l2.length} 条匹配对话：`]
    data.l2.forEach((r, idx) => {
      const sid = r.session_id.slice(0, 16)
      const ts = r.timestamp.slice(0, 19) || '?'
      const content = r.content.slice(0, 400)
      lines.push(`\n--- ${idx + 1}. [${sid}] ${r.role} (${ts}) ---`)
      lines.push(`  → ${content.slice(0, 200)}${content.length > 200 ? '…' : ''}`)
    })
    sections.push(`## 历史对话\n${lines.join('\n')}`)
  }
  if (!sections.length) {
    return `未找到与「${data.query}」匹配的事实或历史对话（L2 仅含已蒸馏并索引的 session）。`
  }
  return sections.join('\n\n')
}

async function postMemoryAction(path: MemoryAction, confirmText: string) {
  if (!window.confirm(confirmText)) return

  busy.value = true
  busyAction.value = path
  statusMessage.value = ''
  error.value = ''
  try {
    const d = await memoryAction(path)
    statusMessage.value = d.message || '完成'
  } catch (e) {
    error.value = `操作失败: ${e instanceof Error ? e.message : String(e)}`
  } finally {
    busy.value = false
    busyAction.value = ''
  }
}

function runL2Distill() {
  return postMemoryAction(
    'l2-distill',
    '从全部 L1 session 重新生成 processed/（L2），不更新 FTS 索引。数据量大时可能耗时较久，确定继续？',
  )
}

function runL2Reindex() {
  return postMemoryAction(
    'l2-reindex',
    '清空并重建 L2 FTS 索引（index/l2.db），不重新蒸馏。确定继续？',
  )
}

function runL3Reindex() {
  return postMemoryAction(
    'l3-reindex',
    '清空并重建 L3 FTS 索引（index/l3.db），不修改 memory/*.md 事实文件。确定继续？',
  )
}

async function runSearch() {
  const q = query.value.trim()
  if (!q) return

  searching.value = true
  error.value = ''
  try {
    const d = await memorySearch({
      query: q,
      limit: limit.value,
      session_limit: sessionLimit.value,
      session: sessionFilter.value.trim() || undefined,
    })
    result.value = d as typeof result.value
    lastQuery.value = q
    searched.value = true
  } catch (e) {
    error.value = `检索失败: ${e instanceof Error ? e.message : String(e)}`
  } finally {
    searching.value = false
  }
}
</script>
