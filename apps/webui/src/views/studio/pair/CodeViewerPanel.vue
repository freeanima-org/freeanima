<template>
  <div class="h-full flex flex-col min-h-0 bg-base-100">
    <div v-if="!file" class="flex-1 flex items-center justify-center text-base-content/40 text-sm">
      选择文件以查看内容
    </div>
    <template v-else>
      <div class="px-3 py-1.5 border-b border-base-300 text-xs font-mono truncate shrink-0 bg-base-200/50">
        {{ file.path }}
        <span class="text-base-content/50 ml-2">{{ file.language }} · {{ formatSize(file.size) }}</span>
      </div>
      <div ref="scrollArea" class="flex-1 overflow-auto min-h-0">
        <table class="code-viewer-table">
          <tbody>
            <tr
              v-for="(_line, i) in lines"
              :key="i"
              :class="{ 'code-line-highlight': highlightLine === i + 1 }"
              :data-line="i + 1"
            >
              <td class="code-ln">{{ i + 1 }}</td>
              <td class="code-content"><pre v-html="highlightedLines[i]"></pre></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, nextTick, ref } from 'vue'
import hljs from 'highlight.js/lib/core'
import typescript from 'highlight.js/lib/languages/typescript'
import javascript from 'highlight.js/lib/languages/javascript'
import python from 'highlight.js/lib/languages/python'
import json from 'highlight.js/lib/languages/json'
import yaml from 'highlight.js/lib/languages/yaml'
import markdown from 'highlight.js/lib/languages/markdown'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import xml from 'highlight.js/lib/languages/xml'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import java from 'highlight.js/lib/languages/java'
import sql from 'highlight.js/lib/languages/sql'
import ini from 'highlight.js/lib/languages/ini'
import 'highlight.js/styles/github-dark.css'

hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('json', json)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('css', css)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('vue', xml)
hljs.registerLanguage('go', go)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('java', java)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('ini', ini)
hljs.registerLanguage('dockerfile', bash)

const props = defineProps({
  file: { type: Object, default: null },
})

const scrollArea = ref(null)

const lines = computed(() => {
  if (!props.file?.content) return []
  return props.file.content.split('\n')
})

const highlightLine = computed(() => props.file?.highlightLine || null)

const highlightedLines = computed(() => {
  const lang = props.file?.language || 'plaintext'
  const registered = hljs.getLanguage(lang)
  return lines.value.map((line) => {
    if (!registered) return escapeHtml(line)
    try {
      return hljs.highlight(line, { language: lang }).value
    } catch {
      return escapeHtml(line)
    }
  })
})

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function formatSize(n) {
  if (n < 1024) return `${n} B`
  return `${(n / 1024).toFixed(1)} KB`
}

watch(
  () => [props.file?.path, highlightLine.value],
  () => {
    if (!highlightLine.value) return
    nextTick(() => {
      const el = scrollArea.value?.querySelector(`[data-line="${highlightLine.value}"]`)
      el?.scrollIntoView({ block: 'center' })
    })
  },
)
</script>

<style scoped>
.code-viewer-table {
  width: 100%;
  border-collapse: collapse;
  font-family: ui-monospace, monospace;
  font-size: 13px;
  line-height: 1.5;
}
.code-ln {
  width: 3rem;
  padding: 0 0.75rem;
  text-align: right;
  color: oklch(var(--bc) / 0.35);
  user-select: none;
  vertical-align: top;
  border-right: 1px solid oklch(var(--b3));
  background: oklch(var(--b2) / 0.5);
}
.code-content {
  padding: 0 1rem;
  white-space: pre;
  vertical-align: top;
}
.code-content pre {
  margin: 0;
  display: inline;
}
.code-line-highlight .code-ln,
.code-line-highlight .code-content {
  background: oklch(var(--p) / 0.15);
}
</style>
