<template>
  <div class="h-full flex flex-col min-h-0">
    <!-- Tab 栏 -->
    <div class="flex border-b border-base-300 shrink-0 text-xs">
      <button
        type="button"
        class="flex-1 px-2 py-1.5 font-medium text-center hover:bg-base-300/30 transition-colors"
        :class="leftTab === 'tree' ? 'bg-base-200 border-b-2 border-primary' : 'text-base-content/50'"
        @click="leftTab = 'tree'"
      >
        📁 目录树
      </button>
      <button
        type="button"
        class="flex-1 px-2 py-1.5 font-medium text-center hover:bg-base-300/30 transition-colors"
        :class="leftTab === 'search' ? 'bg-base-200 border-b-2 border-primary' : 'text-base-content/50'"
        @click="leftTab = 'search'"
      >
        🔍 搜索
      </button>
    </div>

    <!-- 目录树 -->
    <template v-if="leftTab === 'tree'">
      <div class="p-2 border-b border-base-300 shrink-0">
        <input
          v-model="filterText"
          type="search"
          class="input input-sm input-bordered w-full"
          placeholder="过滤文件名…"
          autocomplete="off"
        />
      </div>
      <div ref="treeRoot" class="flex-1 overflow-y-auto p-1 text-sm font-mono min-h-0">
        <div v-if="store.loading" class="p-4 text-center text-base-content/50">
          <span class="loading loading-spinner loading-sm"></span>
        </div>
        <TreeNode
          v-for="node in filteredTree"
          :key="nodePath(node, '')"
          :node="node"
          :path="node.name"
          :expanded-paths="expandedPaths"
          :selected="selectedPath"
          @toggle="toggleExpand"
          @select="onSelectFile"
        />
        <div v-if="!store.loading && filteredTree.length === 0" class="p-4 text-xs text-base-content/50">
          无匹配文件
        </div>
      </div>
    </template>

    <!-- 全局搜索 -->
    <template v-if="leftTab === 'search'">
      <div class="p-2 border-b border-base-300 shrink-0">
        <form class="flex gap-1" @submit.prevent="doGlobalSearch">
          <input
            v-model="globalQuery"
            type="search"
            class="input input-sm input-bordered flex-1"
            placeholder="搜索文件内容…"
          />
          <button type="submit" class="btn btn-sm btn-ghost" :disabled="!globalQuery.trim()">搜</button>
        </form>
      </div>
      <div class="flex-1 overflow-y-auto min-h-0">
        <div v-if="store.searchResults.length === 0" class="p-4 text-xs text-base-content/50 text-center">
          输入关键词搜索项目文件
        </div>
        <button
          v-for="(hit, i) in store.searchResults"
          :key="i"
          type="button"
          class="w-full text-left px-2 py-1.5 hover:bg-base-300/50 text-xs border-b border-base-300/30"
          @click="jumpToHit(hit)"
        >
          <div class="font-mono text-primary truncate">{{ hit.file }}:{{ hit.line }}</div>
          <div class="truncate text-base-content/70">{{ hit.content }}</div>
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { usePairProgrammingStore } from '../../../stores/studio/pair-programming'
import TreeNode from './TreeNode.vue'

const store = usePairProgrammingStore()
const leftTab = ref('tree')
const filterText = ref('')
const globalQuery = ref('')
const expandedPaths = ref([])
const selectedPath = ref('')
const treeRoot = ref<HTMLElement | null>(null)

function nodePath(node, parentPath) {
  return parentPath ? `${parentPath}/${node.name}` : node.name
}

/** 纯函数：过滤树并收集需展开的目录路径，无副作用 */
function filterTreePure(nodes, parentPath, q) {
  const tree = []
  const expand = new Set()
  for (const node of nodes) {
    const path = nodePath(node, parentPath)
    if (node.type === 'directory') {
      const sub = filterTreePure(node.children || [], path, q)
      if (sub.tree.length || node.name.toLowerCase().includes(q)) {
        tree.push({ ...node, children: sub.tree })
        expand.add(path)
        for (const p of sub.expand) expand.add(p)
      }
    } else if (node.name.toLowerCase().includes(q) || path.toLowerCase().includes(q)) {
      tree.push(node)
      let p = parentPath
      while (p) {
        expand.add(p)
        p = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : ''
      }
    }
  }
  return { tree, expand: [...expand] }
}

const filteredTree = computed(() => {
  const q = filterText.value.trim().toLowerCase()
  if (!q) return store.fileTree
  return filterTreePure(store.fileTree, '', q).tree
})

function expandTopLevel(tree) {
  return tree.filter((n) => n.type === 'directory').map((n) => n.name)
}

function applyExpandedForFilter(q) {
  if (!q) {
    if (store.fileTree?.length) {
      expandedPaths.value = expandTopLevel(store.fileTree)
    }
    return
  }
  expandedPaths.value = filterTreePure(store.fileTree, '', q).expand
}

function toggleExpand(path) {
  if (expandedPaths.value.includes(path)) {
    expandedPaths.value = expandedPaths.value.filter((p) => p !== path)
  } else {
    expandedPaths.value = [...expandedPaths.value, path]
  }
}

function onSelectFile(path) {
  selectedPath.value = path
  store.openFile(path)
}

async function doGlobalSearch() {
  await store.globalSearch(globalQuery.value)
}

function jumpToHit(hit: Record<string, unknown>) {
  const file = String(hit.file ?? '')
  selectedPath.value = file
  const parts = file.split('/')
  const paths: string[] = []
  for (let i = 1; i < parts.length; i++) {
    paths.push(parts.slice(0, i).join('/'))
  }
  expandedPaths.value = [...new Set([...expandedPaths.value, ...paths])]
  store.openFile(file, Number(hit.line))
}

watch(filterText, (text) => {
  applyExpandedForFilter(text.trim().toLowerCase())
})

watch(
  () => store.fileTree,
  (tree) => {
    if (tree?.length && !filterText.value.trim()) {
      expandedPaths.value = expandTopLevel(tree)
    }
  },
  { immediate: true },
)

watch(
  () => store.currentFile?.path,
  (p) => {
    if (p) selectedPath.value = String(p)
  },
)
</script>
