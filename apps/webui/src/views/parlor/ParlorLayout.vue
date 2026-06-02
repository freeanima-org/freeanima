<template>
  <ResponsiveSidebarLayout title="会客厅" subtitle="Parlor" :show-sidebar-header="false">
    <template #mobile-actions>
      <button class="btn btn-primary btn-sm" @click="newSession">＋</button>
    </template>

    <template #sidebar="{ close }">
      <div class="p-2">
        <button class="btn btn-primary btn-sm w-full" @click="newSession">＋ 新会话</button>
      </div>

      <div class="flex-1 overflow-y-auto px-2 py-1 space-y-1">
        <div
          v-for="s in sessionsStore.sessions"
          :key="s.id"
          class="session-item cursor-pointer relative"
          :class="s.id === sessionsStore.currentId ? 'sidebar-nav-active' : ''"
          @click="selectSession(s, close)"
          @contextmenu.prevent="openContextMenu($event, s)"
        >
          <div class="truncate">{{ sessionLabel(s) }}</div>
        </div>
      </div>
    </template>

    <router-view />

    <!-- Context menu -->
    <div
      v-if="contextMenu.visible"
      class="fixed z-50 bg-base-100 border border-base-300 rounded-lg shadow-xl py-1 min-w-[140px]"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
    >
      <div
        class="px-3 py-1.5 hover:bg-base-300 cursor-pointer text-sm"
        @click="startRename"
      >
        ✏️ 重命名
      </div>
    </div>

    <!-- Rename dialog -->
    <div
      v-if="showRenameDialog"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="cancelRename"
    >
      <div class="bg-base-100 rounded-xl p-5 shadow-2xl w-full max-w-sm">
        <h3 class="text-sm font-bold mb-3">修改标题</h3>
        <input
          ref="renameInput"
          v-model="renameText"
          type="text"
          class="input input-bordered w-full text-sm"
          placeholder="输入新标题"
          @keyup.enter="confirmRename"
          @keyup.escape="cancelRename"
        />
        <div class="flex justify-end gap-2 mt-3">
          <button class="btn btn-ghost btn-sm" @click="cancelRename">取消</button>
          <button class="btn btn-primary btn-sm" @click="confirmRename">确定</button>
        </div>
      </div>
    </div>
  </ResponsiveSidebarLayout>
</template>

<script setup lang="ts">
import type { SessionListItem } from '@freeanima/legacy-api'
import { ref, reactive, onMounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ResponsiveSidebarLayout from '../../components/ResponsiveSidebarLayout.vue'
import { useSessionsStore } from '../../stores/parlor/sessions'

const sessionsStore = useSessionsStore()
const route = useRoute()
const router = useRouter()

const contextMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  sessionId: null as string | null,
})

const showRenameDialog = ref(false)
const renameText = ref('')
const renameInput = ref<HTMLInputElement | null>(null)

function sessionLabel(item: SessionListItem) {
  const id = item.id
  const title = item.title || ''
  if (title) return title
  const p = id.split('_')
  if (p.length >= 2) {
    return `${p[0].slice(0, 4)}-${p[0].slice(4, 6)}-${p[0].slice(6)} ${p[1].slice(0, 2)}:${p[1].slice(2, 4)}`
  }
  return id
}

function openContextMenu(event: MouseEvent, item: SessionListItem) {
  contextMenu.visible = true
  contextMenu.x = event.clientX
  contextMenu.y = event.clientY
  contextMenu.sessionId = item.id
}

function closeContextMenu() {
  contextMenu.visible = false
}

function startRename() {
  const s = sessionsStore.sessions.find((x) => x.id === contextMenu.sessionId)
  renameText.value = (s && s.title) || ''
  showRenameDialog.value = true
  closeContextMenu()
  nextTick(() => renameInput.value?.focus())
}

async function confirmRename() {
  const title = renameText.value.trim()
  if (title && contextMenu.sessionId) {
    await sessionsStore.renameSession(contextMenu.sessionId, title)
  }
  showRenameDialog.value = false
  renameText.value = ''
}

function cancelRename() {
  showRenameDialog.value = false
  renameText.value = ''
}

document.addEventListener('click', closeContextMenu)

async function newSession() {
  const id = await sessionsStore.newSession()
  if (id) navigateToChat(id)
}

function navigateToChat(sessionId: string) {
  router.push({ name: 'parlor-chat', query: { session: sessionId } })
}

function selectSession(item: SessionListItem, close?: () => void) {
  navigateToChat(item.id)
  close?.()
}

async function syncFromRoute() {
  const q = route.query.session
  const sessionId = typeof q === 'string' ? q : Array.isArray(q) ? q[0] : null

  if (sessionId) {
    if (sessionId !== sessionsStore.currentId) {
      await sessionsStore.selectSession(sessionId)
    }
    return
  }

  if (sessionsStore.sessions.length === 0) return

  const id = sessionsStore.currentId || sessionsStore.sessions[0]?.id
  if (!id) return

  await sessionsStore.selectSession(id)
  if (route.name === 'parlor-chat') {
    router.replace({ name: 'parlor-chat', query: { session: id } })
  }
}

onMounted(async () => {
  await sessionsStore.fetchSessions()
  await syncFromRoute()
})

watch(
  () => route.query.session,
  async (q) => {
    const sessionId = typeof q === 'string' ? q : Array.isArray(q) ? q[0] : null
    if (sessionId && sessionId !== sessionsStore.currentId) {
      await sessionsStore.selectSession(sessionId)
    }
  },
)
</script>
