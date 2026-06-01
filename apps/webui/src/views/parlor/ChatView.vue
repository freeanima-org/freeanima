<template>
  <div class="h-full flex flex-col">
    <!-- Messages -->
    <div ref="msgArea" class="flex-1 overflow-y-auto p-4 space-y-4">
      <!-- Empty state -->
      <div v-if="!sessionsStore.currentId" class="flex items-center justify-center h-full text-base-content/40 text-sm">
        选择一个会话开始对话
      </div>
      <div v-else-if="sessionsStore.display.length === 0 && !chatStore.streaming" class="flex items-center justify-center h-full text-base-content/40 text-sm">
        发送第一条消息
      </div>

      <!-- 统一 display 列表：按时间顺序排列消息和工具块 -->
      <template v-for="(item, i) in sessionsStore.display" :key="'d'+i">
        <!-- user 消息 -->
        <div v-if="item.type === 'message' && item.role === 'user'" class="chat chat-end">
          <div class="chat-bubble chat-bubble-primary whitespace-pre-wrap">{{ item.content }}</div>
        </div>
        <!-- assistant 消息 -->
        <div v-else-if="item.type === 'message' && item.role === 'assistant'" class="chat chat-start">
          <div class="chat-bubble">
            <div class="md-content" v-html="renderMd(item.content)"></div>
          </div>
        </div>
        <!-- 工具调用块 -->
        <div v-else-if="item.type === 'tool_block'" class="chat chat-start">
          <div class="tool-bubble text-xs px-3 py-2">
            <div v-for="(c, ci) in item.calls" :key="ci" class="flex items-center gap-1.5 font-mono">
              <span class="text-success shrink-0">✓</span>
              <span>{{ truncatePreview(c.name + '(' + c.argsPreview + ')') }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- Pending clarify -->
      <div v-if="clarifyPending" class="alert alert-info shadow-sm">
        <div class="w-full space-y-2">
          <p class="font-medium">需要你确认（一条消息回复全部，或发送 /cancel）</p>
          <div v-for="(item, ci) in clarifyPending.items" :key="ci" class="text-sm">
            <p>{{ ci + 1 }}. {{ item.question }}</p>
            <ul v-if="item.choices?.length" class="list-disc list-inside ml-2 text-base-content/70">
              <li v-for="(choice, chi) in item.choices" :key="chi">{{ choice }}</li>
            </ul>
          </div>
        </div>
      </div>

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
      <div v-if="chatStore.streaming && streamAccumulated && toolCalls.length === 0" class="chat chat-start">
        <div class="chat-bubble">
          <div class="md-content" v-html="renderMd(streamAccumulated)"></div>
          <span v-if="!streamDone" class="loading loading-dots loading-xs"></span>
        </div>
      </div>
    </div>

    <!-- Input -->
    <div class="border-t border-base-300 p-4 bg-base-100 relative">
      <form class="flex gap-2 items-end" @submit.prevent="sendMessage">
        <div class="flex-1 relative">
          <ul
            v-if="showCmdMenu"
            class="absolute bottom-full left-0 right-0 mb-1 max-h-48 overflow-y-auto rounded-lg border border-base-300 bg-base-100 shadow-lg z-10"
          >
            <li
              v-for="(cmd, i) in filteredCommands"
              :key="cmd.name"
              class="px-3 py-2 text-sm cursor-pointer flex items-baseline gap-2 hover:bg-base-200"
              :class="{ 'bg-primary/15': i === selectedCmdIdx }"
              @mousedown.prevent="applyCommand(cmd)"
            >
              <span class="font-mono font-medium shrink-0">/{{ cmd.name }}</span>
              <span class="text-xs text-base-content/60 truncate">{{ cmd.description }}</span>
            </li>
          </ul>
          <textarea
            ref="msgInput"
            v-model="inputText"
            rows="1"
            class="textarea textarea-bordered w-full min-h-[2.75rem] max-h-48 resize-none leading-normal py-2.5"
            placeholder="输入消息（Shift+Enter 换行，Enter 发送；/ 开头是命令）"
            :disabled="!sessionsStore.currentId || chatStore.streaming"
            @input="onInput"
            @keydown="onInputKeydown"
          />
        </div>
        <button type="submit" class="btn btn-primary" :disabled="!sessionsStore.currentId || chatStore.streaming || !inputText.trim()">
          发送
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, computed } from 'vue'
import { useSessionsStore } from '../../stores/parlor/sessions'
import { useChatStore } from '../../stores/parlor/chat'
import { listCommands } from '../../api/client'

const sessionsStore = useSessionsStore()
const chatStore = useChatStore()

const msgArea = ref(null)
const msgInput = ref(null)
const inputText = ref('')
const streamAccumulated = ref('')
const streamDone = ref(true)
const toolCalls = ref<Array<{ name: string; argsPreview: string; status: string }>>([])
const commandList = ref([])
const selectedCmdIdx = ref(0)
const clarifyPending = ref(null)

const slashPrefix = computed(() => {
  const text = inputText.value
  if (!text.startsWith('/')) return null
  const body = text.slice(1)
  if (body.includes(' ')) return null
  return body.toLowerCase()
})

const filteredCommands = computed(() => {
  const prefix = slashPrefix.value
  if (prefix === null) return []
  return commandList.value.filter((c) => c.name.toLowerCase().startsWith(prefix))
})

const showCmdMenu = computed(() => filteredCommands.value.length > 0)

onMounted(async () => {
  try {
    commandList.value = await listCommands()
  } catch (e) {
    console.error('Failed to fetch commands:', e)
  }
})

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
    if (msgArea.value) {
      msgArea.value.scrollTop = msgArea.value.scrollHeight
    }
  })
}

const INPUT_MAX_HEIGHT_PX = 192

function applyCommand(cmd) {
  inputText.value = `/${cmd.name} `
  selectedCmdIdx.value = 0
  nextTick(() => {
    resizeInput()
    msgInput.value?.focus()
  })
}

function onInput() {
  selectedCmdIdx.value = 0
  resizeInput()
}

function resizeInput() {
  const el = msgInput.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, INPUT_MAX_HEIGHT_PX)}px`
}

function onInputKeydown(e) {
  if (showCmdMenu.value) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      selectedCmdIdx.value = Math.min(
        selectedCmdIdx.value + 1,
        filteredCommands.value.length - 1,
      )
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      selectedCmdIdx.value = Math.max(selectedCmdIdx.value - 1, 0)
      return
    }
    if ((e.key === 'Tab' || e.key === 'Enter') && !e.shiftKey && !e.isComposing) {
      e.preventDefault()
      applyCommand(filteredCommands.value[selectedCmdIdx.value])
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      inputText.value = ''
      selectedCmdIdx.value = 0
      nextTick(resizeInput)
      return
    }
  }
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return
  e.preventDefault()
  void sendMessage()
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || !sessionsStore.currentId || chatStore.streaming) return

  inputText.value = ''
  nextTick(resizeInput)

  sessionsStore.appendItem({ type: 'message', role: 'user', content: text })
  if (clarifyPending.value) clarifyPending.value = null
  scrollDown()

  streamAccumulated.value = ''
  streamDone.value = false
  toolCalls.value = []
  clarifyPending.value = null

  await chatStore.send(sessionsStore.currentId, text, {
    onToken: (fullText) => {
      streamAccumulated.value = fullText
      scrollDown()
    },
    onToolBegin: (data) => {
      const tool = data.tool || '?'
      const args = data.args || {}
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
    onAwaitingClarify: (data) => {
      if (Array.isArray(data.items) && data.items.length) {
        clarifyPending.value = {
          items: data.items,
          timeout_sec: data.timeout_sec ?? 1800,
        }
      }
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
      const text = `⚠️ ${msg}`
      sessionsStore.appendItem({ type: 'message', role: 'assistant', content: text })
      streamAccumulated.value = ''
      toolCalls.value = []
      scrollDown()
    },
    onDone: () => {
      streamDone.value = true

      // 工具调用保留到 display
      if (toolCalls.value.length > 0) {
        sessionsStore.appendItem({
          type: 'tool_block',
          calls: toolCalls.value.map(t => ({ name: t.name, argsPreview: t.argsPreview, status: 'done' })),
        })
        toolCalls.value = []
      }

      const content = streamAccumulated.value.trim()
      if (content) {
        sessionsStore.appendItem({ type: 'message', role: 'assistant', content })
      }
      streamAccumulated.value = ''
      scrollDown()
    },
  })
}

watch(
  () => [sessionsStore.currentId, sessionsStore.display.length],
  ([id]) => {
    if (!id) return
    nextTick(() => {
      msgInput.value?.focus()
      resizeInput()
    })
    scrollDown()
  },
  { flush: 'post' },
)
</script>
