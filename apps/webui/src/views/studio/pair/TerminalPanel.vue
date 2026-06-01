<template>
  <div class="h-full flex flex-col min-h-0 border-t border-base-300 bg-[#1e1e1e] overflow-hidden">
    <div class="flex items-center justify-between px-2 py-1 border-b border-base-300 shrink-0 bg-base-200/30">
      <span class="text-xs font-medium text-base-content/70">终端</span>
      <button type="button" class="btn btn-ghost btn-xs" @click="reconnect">重连</button>
    </div>
    <div ref="termEl" class="flex-1 min-h-0 overflow-hidden" />
    <div v-if="statusMsg" class="px-2 py-1 text-xs text-error shrink-0 bg-base-200/30">{{ statusMsg }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import 'xterm/css/xterm.css'
import { studioTerminalWsUrl } from '../../../api/client'

const termEl = ref(null)
const statusMsg = ref('')

let term = null
let fitAddon = null
let ws = null
let ro = null

function fitTerminal() {
  if (!fitAddon || !termEl.value) return
  try {
    fitAddon.fit()
    sendResize()
  } catch {
    /* 容器尺寸为 0 时忽略 */
  }
}

function sendInput(data) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'input', data }))
  }
}

function sendResize() {
  if (!term || ws?.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
}

function connect() {
  disconnect(false)
  statusMsg.value = ''
  if (!term) return

  ws = new WebSocket(studioTerminalWsUrl())

  ws.onopen = () => {
    statusMsg.value = ''
    nextTick(() => {
      fitTerminal()
    })
  }

  ws.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data)
      if (msg.type === 'output') {
        term.write(msg.data)
      } else if (msg.type === 'ready') {
        nextTick(fitTerminal)
      } else if (msg.type === 'error') {
        statusMsg.value = msg.message
      } else if (msg.type === 'exit') {
        statusMsg.value = `进程退出 (${msg.code})`
      }
    } catch {
      term.write(evt.data)
    }
  }

  ws.onerror = () => {
    statusMsg.value = 'WebSocket 连接失败'
  }

  ws.onclose = () => {
    if (!statusMsg.value) statusMsg.value = '连接已断开'
  }
}

function disconnect(clearTerm = true) {
  ws?.close()
  ws = null
  if (clearTerm && term) term.clear()
}

function reconnect() {
  disconnect()
  connect()
}

onMounted(async () => {
  term = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    lineHeight: 1.2,
    fontFamily: 'ui-monospace, "Cascadia Code", Menlo, monospace',
    convertEol: true,
    scrollback: 5000,
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#d4d4d4',
    },
  })
  fitAddon = new FitAddon()
  term.loadAddon(fitAddon)
  term.open(termEl.value)

  term.onData(sendInput)

  ro = new ResizeObserver(() => {
    requestAnimationFrame(fitTerminal)
  })
  ro.observe(termEl.value)

  await nextTick()
  requestAnimationFrame(fitTerminal)
  connect()
})

onUnmounted(() => {
  ro?.disconnect()
  disconnect()
  term?.dispose()
})
</script>

<style scoped>
:deep(.xterm) {
  height: 100%;
  padding: 4px;
}
:deep(.xterm-viewport) {
  overflow-y: auto !important;
}
</style>
