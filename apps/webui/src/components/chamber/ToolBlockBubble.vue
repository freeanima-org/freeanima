<template>
  <div class="tool-bubble text-xs">
    <button
      type="button"
      class="w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-base-300/40 rounded-2xl transition-colors"
      @click="expanded = !expanded"
    >
      <span class="shrink-0 mt-0.5 text-base-content/50">{{ expanded ? '▼' : '▶' }}</span>
      <div class="flex-1 min-w-0 space-y-1">
        <div class="font-medium text-base-content/70">
          工具调用 · {{ calls.length }} 项
        </div>
        <div
          v-for="(c, ci) in calls"
          :key="c.tool_call_id || ci"
          class="flex items-center gap-1.5 font-mono truncate"
        >
          <span class="shrink-0" :class="statusClass(c.status)">{{ statusIcon(c.status) }}</span>
          <span class="truncate">{{ c.name }}({{ c.argsPreview || '…' }})</span>
        </div>
      </div>
    </button>

    <div v-if="expanded" class="border-t border-base-300/50 px-3 py-2 space-y-3">
      <div
        v-for="(c, ci) in calls"
        :key="'detail-' + (c.tool_call_id || ci)"
        class="rounded-lg bg-base-100/60 p-2 space-y-1.5"
      >
        <div class="flex items-center gap-2 font-mono font-medium">
          <span :class="statusClass(c.status)">{{ statusIcon(c.status) }}</span>
          <span>{{ c.name }}</span>
          <span class="text-base-content/40 text-[10px]">{{ c.tool_call_id?.slice(0, 8) }}</span>
        </div>
        <div v-if="c.args && Object.keys(c.args).length">
          <div class="text-base-content/50 mb-0.5">参数</div>
          <pre class="text-[11px] overflow-x-auto max-h-40 whitespace-pre-wrap break-all">{{ formatJson(c.args) }}</pre>
        </div>
        <div v-if="c.result">
          <div class="text-base-content/50 mb-0.5">结果</div>
          <pre class="text-[11px] overflow-x-auto max-h-60 whitespace-pre-wrap break-all">{{ truncateResult(c.result) }}</pre>
        </div>
        <div v-else-if="c.status === 'pending'" class="text-base-content/40 italic">
          等待结果…
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { DisplayToolCall } from '@freeanima/legacy-api'

defineProps<{
  calls: DisplayToolCall[]
}>()

const expanded = ref(false)

function statusIcon(status: string) {
  if (status === 'pending') return '◌'
  if (status === 'running') return '…'
  if (status === 'error') return '✗'
  return '✓'
}

function statusClass(status: string) {
  if (status === 'error') return 'text-error'
  if (status === 'pending' || status === 'running') return 'text-base-content/40'
  return 'text-success'
}

function formatJson(obj: Record<string, unknown>) {
  try {
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(obj)
  }
}

function truncateResult(text: string, max = 8000) {
  if (text.length <= max) return text
  return text.slice(0, max) + '\n…（已截断）'
}
</script>
