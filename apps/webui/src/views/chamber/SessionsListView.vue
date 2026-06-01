<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-bold">会话列表</h2>
      <button
        class="btn btn-ghost btn-xs"
        :disabled="store.loadingSessions"
        @click="reload"
      >
        刷新
      </button>
    </div>

    <div v-if="store.loadingSessions" class="flex justify-center py-8">
      <span class="loading loading-dots loading-md"></span>
    </div>

    <div v-else class="card bg-base-200">
      <div class="card-body p-0">
        <div v-if="store.sortedSessions.length === 0" class="text-sm text-base-content/50 p-4">
          无会话
        </div>
        <div v-else class="divide-y divide-base-300/50">
          <div
            v-for="s in store.sortedSessions"
            :key="s.id"
            class="transition-colors"
            :class="store.selectedId === s.id ? 'bg-base-300/30' : ''"
          >
            <button
              type="button"
              class="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-base-300/20 transition-colors"
              @click="store.toggleSession(s.id)"
            >
              <span class="shrink-0 text-base-content/50 w-4">
                {{ store.selectedId === s.id ? '▼' : '▶' }}
              </span>
              <span class="badge badge-ghost badge-xs shrink-0">{{ s.platform || 'legacy' }}</span>
              <span class="flex-1 truncate text-sm">{{ s.title || '（无标题）' }}</span>
              <span class="font-mono text-[10px] text-base-content/40 shrink-0 hidden sm:inline">
                {{ s.id }}
              </span>
              <span v-if="s.created" class="text-[10px] text-base-content/40 shrink-0 hidden md:inline">
                {{ formatCreated(s.created) }}
              </span>
            </button>

            <div
              v-if="store.selectedId === s.id"
              class="px-4 pb-4 border-t border-base-300/30 bg-base-100/40"
            >
              <div class="font-mono text-[10px] text-base-content/40 py-2 break-all sm:hidden">
                {{ s.id }}
              </div>
              <SessionMessagePanel
                :items="store.display"
                :total="store.total"
                :current-page="store.currentPage"
                :page-count="store.pageCount"
                :page-size="store.limit"
                :page-offset="store.offset"
                :loading="store.loadingMessages"
                @page-change="(p) => store.goToPage(p)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="store.error" class="alert alert-error text-sm mt-4">{{ store.error }}</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useChamberSessionsStore } from '../../stores/chamber/sessions'
import SessionMessagePanel from '../../components/chamber/SessionMessagePanel.vue'

const store = useChamberSessionsStore()

function formatCreated(iso: string) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso.slice(0, 16)
    return d.toLocaleString('zh-CN', { hour12: false })
  } catch {
    return iso.slice(0, 16)
  }
}

async function reload() {
  await store.fetchSessions()
}

onMounted(() => {
  void store.fetchSessions()
})
</script>
