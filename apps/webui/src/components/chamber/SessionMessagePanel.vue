<template>
  <div class="space-y-3 py-3">
    <div v-if="loading" class="flex justify-center py-6">
      <span class="loading loading-dots loading-sm"></span>
    </div>

    <div v-else-if="items.length === 0" class="text-sm text-base-content/50 text-center py-4">
      此页无消息
    </div>

    <template v-else>
      <template v-for="(item, i) in items" :key="pageOffset + i">
        <div v-if="item.type === 'message' && item.role === 'user'" class="chat chat-end">
          <div class="chat-bubble chat-bubble-primary whitespace-pre-wrap text-sm">{{ item.content }}</div>
        </div>
        <div v-else-if="item.type === 'message' && item.role === 'assistant'" class="chat chat-start">
          <div class="chat-bubble text-sm">
            <div class="md-content" v-html="renderMd(item.content)"></div>
          </div>
        </div>
        <div v-else-if="item.type === 'tool_block'" class="chat chat-start max-w-full">
          <ToolBlockBubble :calls="item.calls" />
        </div>
      </template>
    </template>

    <div
      v-if="total > pageSize"
      class="flex items-center justify-between gap-2 pt-2 border-t border-base-300/50 text-xs"
    >
      <span class="text-base-content/60">
        共 {{ total }} 条 · 第 {{ currentPage }} / {{ pageCount }} 页
      </span>
      <div class="join">
        <button
          class="btn btn-xs join-item"
          :disabled="currentPage <= 1 || loading"
          @click="$emit('page-change', currentPage - 1)"
        >
          上一页
        </button>
        <button
          class="btn btn-xs join-item"
          :disabled="currentPage >= pageCount || loading"
          @click="$emit('page-change', currentPage + 1)"
        >
          下一页
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { marked } from 'marked'
import type { DisplayItem } from '@freeanima/legacy-api'
import ToolBlockBubble from './ToolBlockBubble.vue'

defineProps<{
  items: DisplayItem[]
  total: number
  currentPage: number
  pageCount: number
  pageSize: number
  pageOffset: number
  loading: boolean
}>()

defineEmits<{
  'page-change': [page: number]
}>()

function renderMd(text: string) {
  if (!text) return ''
  try {
    return marked.parse(text, { breaks: true, gfm: true }) as string
  } catch {
    return text
  }
}
</script>
