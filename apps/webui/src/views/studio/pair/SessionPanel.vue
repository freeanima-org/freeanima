<template>
  <div class="h-full flex flex-row min-h-0 border-l border-base-300">
    <div class="flex-1 flex flex-col min-h-0 min-w-0">
      <div ref="msgArea" class="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        <div v-if="!store.currentSessionId" class="text-center text-base-content/40 text-sm pt-8">
          创建或选择会话
        </div>

        <!-- 统一 display 列表 -->
        <template v-for="(item, i) in store.display" :key="'d'+i">
          <div v-if="item.type === 'message' && item.role === 'user'" class="chat chat-end">
            <div class="chat-bubble chat-bubble-primary chat-bubble-sm whitespace-pre-wrap">{{ item.content }}</div>
          </div>
          <div v-else-if="item.type === 'message' && item.role === 'assistant'" class="chat chat-start">
            <div class="chat-bubble chat-bubble-sm">
              <div class="md-content text-sm" v-html="renderMd(item.content)"></div>
            </div>
          </div>
          <div v-else-if="item.type === 'tool_block'" class="chat chat-start">
            <div class="tool-bubble text-xs px-3 py-2">
              <div v-for="(c, ci) in item.calls" :key="ci" class="flex items-center gap-1.5 font-mono">
                <span class="text-success shrink-0">✓</span>
                <span>{{ truncatePreview(c.name + '(' + c.argsPreview + ')') }}</span>
              </div>
            </div>
          </div>
        </template>

        <!-- Streaming tool calls -->
        <div v-if="toolCalls.length > 0" class="chat chat-start">
          <div class="tool-bubble text-xs px-3 py-2">
            <div v-for="(t, ti) in toolCalls" :key="ti" class="flex items-center gap-1.5 font-mono">
              <span class="shrink-0">
                <span v-if="t.status === 'pending'" class="text-base-content/40">◌</span>
                <span v-else-if="t.status === 'running'" class="loading loading-spinner loading-xs text-info"></span>
                <span v-else-if="t.status === 'done'" class="text-success">✓</span>
                <span v-else class="text-error">✗</span>
              </span>
              <span>{{ truncatePreview(t.name + '(' + t.argsPreview + ')') }}</span>
            </div>
          </div>
        </div>

        <!-- Streaming assistant -->
        <div v-if="chatStore.streaming && chatStore.streamingSessionId === store.currentSessionId && streamAccumulated && toolCalls.length === 0" class="chat chat-start">
          <div class="chat-bubble chat-bubble-sm">
            <div class="md-content text-sm" v-html="renderMd(streamAccumulated)"></div>
            <span v-if="!streamDone" class="loading loading-dots loading-xs"></span>
          </div>
        </div>
      </div>

      <div class="border-t border-base-300 shrink-0">
        <form @submit.prevent="sendMessage">
          <div class="flex justify-end px-2 pt-1.5 pb-0">
            <button type="submit" class="btn btn-primary btn-xs" :disabled="!store.currentSessionId || chatStore.streaming || !inputText.trim()">
              发送
            </button>
          </div>
          <div class="p-2 pt-1">
            <textarea
              ref="msgInput"
              v-model="inputText"
              rows="3"
              class="textarea textarea-bordered textarea-sm w-full min-h-[2.5rem] resize-none"
              placeholder="和 Agent 对话…"
              :disabled="!store.currentSessionId || chatStore.streaming"
              @keydown="onKeydown"
            />
          </div>
        </form>
      </div>
    </div>

    <button
      class="shrink-0 w-6 flex items-center justify-center border-l border-base-300 bg-base-200/50 hover:bg-base-300/60 cursor-pointer text-xs text-base-content/40 select-none"
      @click="sessionListVisible = !sessionListVisible"
      :title="sessionListVisible ? '收起会话列表' : '展开会话列表'"
    >
      {{ sessionListVisible ? '▸' : '◂' }}
    </button>

    <div v-show="sessionListVisible" class="w-48 shrink-0 flex flex-col min-h-0 bg-base-200/30">
      <div class="p-2 border-b border-base-300 shrink-0">
        <button class="btn btn-primary btn-sm w-full" @click="newSession">＋ 新会话</button>
      </div>
      <div class="flex-1 overflow-y-auto px-2 py-1 space-y-1">
        <div
          v-for="s in store.sessions"
          :key="s.id"
          class="session-item cursor-pointer truncate text-sm"
          :class="s.id === store.currentSessionId ? 'sidebar-nav-active' : ''"
          @click="selectSession(s)"
          @contextmenu.prevent="openContextMenu($event, s)"
        >
          {{ sessionLabel(s) }}
        </div>
      </div>
    </div>

    <div v-if="showRename" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="showRename = false">
      <div class="bg-base-100 rounded-xl p-4 shadow-2xl w-72">
        <input v-model="renameText" class="input input-bordered w-full text-sm" @keyup.enter="confirmRename" />
        <div class="flex justify-end gap-2 mt-3">
          <button class="btn btn-ghost btn-sm" @click="showRename = false">取消</button>
          <button class="btn btn-primary btn-sm" @click="confirmRename">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import { usePairProgrammingStore } from '../../../stores/studio/pair-programming'
import { useChatStore } from '../../../stores/parlor/chat'
import { STUDIO_PAIR_PLATFORM, listCommands } from '../../../api/client'

const store = usePairProgrammingStore()
const chatStore = useChatStore()

const msgArea = ref(null)
const msgInput = ref(null)
const inputText = ref('')
const streamAccumulated = ref('')
const streamDone = ref(true)
const toolCalls = ref<Array<{ name: string; argsPreview: string; status: string }>>([])
const showRename = ref(false)
const renameText = ref('')
const renameSessionId = ref(null)
const commandList = ref([])
const sessionListVisible = ref(true)

import type { SessionListItem } from '@freeanima/api'

function sessionLabel(item: SessionListItem) {
  const id = item.id
  if (item.title) return item.title
  const p = id.split('_')
  if (p.length >= 2) return `${p[0].slice(0, 4)}-${p[0].slice(4, 6)}-${p[0].slice(6)}`
  return id
}

function renderMd(text) {
  return chatStore.renderMd(text)
}

function truncatePreview(text, maxLen = 30) {
  let len = 0
  let result = ''
  for (const ch of text) {
    const w = ch.charCodeAt(0) > 0x7f ? 2 : 1
    if (len + w > maxLen) {
      result += '…'
      break
    }
    len += w
    result += ch
  }
  return result
}

function scrollDown() {
  nextTick(() => {
    if (msgArea.value) msgArea.value.scrollTop = msgArea.value.scrollHeight
  })
}

async function newSession() {
  if (chatStore.streaming) chatStore.abortStream()
  streamAccumulated.value = ''
  streamDone.value = true
  await store.createNewSession()
  scrollDown()
}

function selectSession(item: SessionListItem) {
  const id = item.id
  if (chatStore.streaming && chatStore.streamingSessionId !== id) chatStore.abortStream()
  store.selectSession(id)
  streamAccumulated.value = ''
  streamDone.value = true
}

function openContextMenu(_evt: MouseEvent, item: SessionListItem) {
  renameSessionId.value = item.id
  renameText.value = item.title || ''
  showRename.value = true
}

async function confirmRename() {
  const title = renameText.value.trim()
  if (title && renameSessionId.value) {
    await store.renameSession(renameSessionId.value, title)
  }
  showRename.value = false
}

function onKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    sendMessage()
  }
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || !store.currentSessionId || chatStore.streaming) return
  inputText.value = ''
  store.appendItem({ type: 'message', role: 'user', content: text })
  scrollDown()
  streamAccumulated.value = ''
  streamDone.value = false
  toolCalls.value = []

  await chatStore.send(store.currentSessionId, text, {
    onToken: (full) => {
      streamAccumulated.value = full
      scrollDown()
    },
    onToolBegin: (data) => {
      const tool = data.tool || '?'
      const args = (data.args || {}) as Record<string, unknown>
      const preview = Object.keys(args).slice(0, 2)
        .map(k => `${k}=${String(args[k]).slice(0, 30)}`)
        .join(', ')
      toolCalls.value.push({ name: String(tool), argsPreview: preview, status: 'running' })
      scrollDown()
    },
    onToolResult: (data) => {
      const tool = data.tool || ''
      if (tool === 'clarify') return
      const found = toolCalls.value.find(t => t.name === tool && (t.status === 'running' || t.status === 'pending'))
      if (found) found.status = 'done'
      scrollDown()
    },
    onToolError: (data) => {
      const tool = data.tool || ''
      const found = toolCalls.value.find(t => t.name === tool && (t.status === 'running' || t.status === 'pending'))
      if (found) found.status = 'error'
      scrollDown()
    },
    onError: (msg) => {
      streamDone.value = true
      store.appendItem({ type: 'message', role: 'assistant', content: `⚠️ ${msg}` })
      streamAccumulated.value = ''
      toolCalls.value = []
      scrollDown()
    },
    onDone: () => {
      streamDone.value = true

      if (toolCalls.value.length > 0) {
        store.appendItem({
          type: 'tool_block',
          calls: toolCalls.value.map(t => ({ name: t.name, argsPreview: t.argsPreview, status: 'done' })),
        })
        toolCalls.value = []
      }

      const remaining = streamAccumulated.value.trim()
      if (remaining) store.appendItem({ type: 'message', role: 'assistant', content: remaining })
      streamAccumulated.value = ''
      scrollDown()
    },
  })
}

onMounted(async () => {
  try {
    commandList.value = await listCommands({ platform: STUDIO_PAIR_PLATFORM })
  } catch {
    commandList.value = await listCommands()
  }
})

watch(() => store.display.length, scrollDown)
</script>
