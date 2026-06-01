<template>
  <div>
    <div v-if="node.type === 'directory'" class="select-none">
      <button
        type="button"
        class="flex items-center gap-1 w-full px-1 py-0.5 rounded hover:bg-base-300/40 text-left"
        @click="emit('toggle', path)"
      >
        <span class="w-3 text-xs opacity-60 shrink-0">{{ isExpanded ? '▼' : '▶' }}</span>
        <span class="truncate text-base-content/80">{{ node.name }}/</span>
      </button>
      <div v-show="isExpanded" class="pl-3 border-l border-base-300/40 ml-2">
        <TreeNode
          v-for="child in node.children || []"
          :key="`${path}/${child.name}`"
          :node="child"
          :path="`${path}/${child.name}`"
          :expanded-paths="expandedPaths"
          :selected="selected"
          @toggle="emit('toggle', $event)"
          @select="emit('select', $event)"
        />
      </div>
    </div>
    <button
      v-else
      type="button"
      class="flex items-center w-full px-1 py-0.5 pl-4 rounded hover:bg-base-300/40 text-left truncate"
      :class="selected === path ? 'bg-primary/15 font-medium' : ''"
      @click="emit('select', path)"
    >
      {{ node.name }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TreeNode from './TreeNode.vue'

const props = defineProps({
  node: { type: Object, required: true },
  path: { type: String, required: true },
  expandedPaths: { type: Array, required: true },
  selected: { type: String, default: '' },
})

const emit = defineEmits(['toggle', 'select'])

const isExpanded = computed(() => props.expandedPaths.includes(props.path))
</script>
