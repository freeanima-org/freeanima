<template>
  <div class="h-full flex flex-col min-h-0 overflow-hidden relative">
    <!-- 未配置 workspace -->
    <div v-if="!configured && !store.loading" class="flex-1 flex items-center justify-center p-8">
      <div class="max-w-md text-center space-y-4">
        <h3 class="text-lg font-bold">配置工作目录</h3>
        <p class="text-sm text-base-content/60">
          结对编程需要先设置 <code class="text-xs bg-base-300 px-1 rounded">studio.workspace</code>。
          可在卧室配置页编辑 <code class="text-xs bg-base-300 px-1 rounded">config.yaml</code>，或在此设置：
        </p>
        <form class="flex gap-2" @submit.prevent="saveWorkspace">
          <input
            v-model="workspaceInput"
            type="text"
            class="input input-bordered flex-1 font-mono text-sm"
            placeholder="/path/to/project"
          />
          <button type="submit" class="btn btn-primary" :disabled="!workspaceInput.trim()">保存</button>
        </form>
        <router-link to="/webui/chamber/config" class="btn btn-ghost btn-sm">前往卧室配置</router-link>
      </div>
    </div>

    <!-- 工作台 -->
    <template v-else>
      <!-- 顶部面板开关 -->
      <div class="shrink-0 flex items-center gap-0.5 px-2 py-1 border-b border-base-300 bg-base-200/40 text-xs">
        <button
          type="button"
          class="btn btn-ghost btn-xs gap-1"
          :class="leftVisible ? '' : 'opacity-40'"
          @click="leftVisible = !leftVisible"
          title="切换左侧面板"
        >
          📁
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-xs gap-1"
          :class="terminalVisible ? '' : 'opacity-40'"
          @click="terminalVisible = !terminalVisible"
          title="切换终端面板"
        >
          ⬇
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-xs gap-1"
          :class="rightVisible ? '' : 'opacity-40'"
          @click="rightVisible = !rightVisible"
          title="切换会话面板"
        >
          💬
        </button>
        <span class="flex-1" />
        <span class="text-base-content/30 text-xs select-none">面板</span>
      </div>

      <!-- 三列工作台 -->
      <div ref="mainRow" class="flex flex-1 min-h-0 overflow-hidden">
        <!-- 左：文件树 / 搜索 -->
        <div
          v-show="leftVisible"
          :class="[
            'shrink-0 flex flex-col min-h-0 border-r border-base-300 bg-base-200/20',
            isMobile ? 'mobile-panel-overlay' : '',
          ]"
          :style="isMobile ? undefined : { width: leftWidth + 'px' }"
        >
          <FileTreePanel />
        </div>
        <div
          v-if="leftVisible && !isMobile"
          class="w-1 shrink-0 cursor-col-resize hover:bg-primary/30 active:bg-primary/50"
          @mousedown="startResize('left', $event)"
        />

        <!-- 中：代码 + 终端 -->
        <div class="flex-1 min-w-0 flex flex-col min-h-0">
          <div class="flex-1 min-h-0">
            <CodeViewerPanel :file="store.currentFile" />
          </div>
          <div
            v-if="terminalVisible"
            class="h-1 shrink-0 cursor-row-resize hover:bg-primary/30 active:bg-primary/50"
            @mousedown="startResize('bottom', $event)"
          />
          <div
            v-show="terminalVisible"
            class="shrink-0 min-h-0"
            :style="{ height: terminalHeight + 'px' }"
          >
            <TerminalPanel />
          </div>
        </div>

        <div
          v-if="rightVisible && !isMobile"
          class="w-1 shrink-0 cursor-col-resize hover:bg-primary/30 active:bg-primary/50"
          @mousedown="startResize('right', $event)"
        />

        <!-- 右：会话 -->
        <div
          v-show="rightVisible"
          :class="[
            'shrink-0 min-h-0',
            isMobile ? 'mobile-panel-overlay' : '',
          ]"
          :style="isMobile ? undefined : { width: rightWidth + 'px' }"
        >
          <SessionPanel />
        </div>
      </div>
    </template>

    <div v-if="store.error" class="absolute bottom-4 left-1/2 -translate-x-1/2 alert alert-warning shadow-lg text-sm max-w-lg z-10">
      {{ store.error }}
      <button type="button" class="btn btn-ghost btn-xs" @click="store.error = ''">关闭</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { usePairProgrammingStore } from '../../stores/studio/pair-programming'
import { putStudioConfig } from '../../api/client'
import { useMediaQuery } from '../../composables/useMediaQuery'
import FileTreePanel from './pair/FileTreePanel.vue'
import CodeViewerPanel from './pair/CodeViewerPanel.vue'
import SessionPanel from './pair/SessionPanel.vue'
import TerminalPanel from './pair/TerminalPanel.vue'

const store = usePairProgrammingStore()
const isMobile = useMediaQuery('(max-width: 1023px)')

const leftWidth = ref(260)
const rightWidth = ref(380)
const terminalHeight = ref(200)
const workspaceInput = ref('')
const mainRow = ref(null)

const leftVisible = ref(true)
const rightVisible = ref(true)
const terminalVisible = ref(true)

watch(
  isMobile,
  (mobile) => {
    if (mobile) {
      leftVisible.value = false
      rightVisible.value = false
      terminalVisible.value = false
    }
  },
  { immediate: true },
)

const configured = computed(() => Boolean(store.config.workspace?.trim()))

async function saveWorkspace() {
  const ws = workspaceInput.value.trim()
  if (!ws) return
  await putStudioConfig({ workspace: ws })
  await store.fetchConfig()
  await store.fetchTree()
}

function startResize(edge, evt) {
  evt.preventDefault()
  const startX = evt.clientX
  const startY = evt.clientY
  const startLeft = leftWidth.value
  const startRight = rightWidth.value
  const startTerm = terminalHeight.value

  function onMove(e) {
    if (edge === 'left') {
      leftWidth.value = Math.min(400, Math.max(160, startLeft + e.clientX - startX))
    } else if (edge === 'right') {
      rightWidth.value = Math.min(700, Math.max(280, startRight - (e.clientX - startX)))
    } else if (edge === 'bottom') {
      terminalHeight.value = Math.min(500, Math.max(100, startTerm - (e.clientY - startY)))
    }
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

onMounted(async () => {
  await store.fetchConfig()
  workspaceInput.value = store.config.workspace || ''
  await store.fetchSessions()
  if (store.sessions.length && !store.currentSessionId) {
    await store.selectSession((store.sessions[0] as { id: string }).id)
  }
  if (configured.value) {
    await store.fetchTree()
  }
})
</script>
