<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useAppStore } from '@/stores/appStore'
import TopToolbar from '@/components/TopToolbar.vue'
import LeftPanel from '@/components/LeftPanel.vue'
import VisualizerPanel from '@/components/VisualizerPanel.vue'
import ConsoleDrawer from '@/components/ConsoleDrawer.vue'
import StatusRibbon from '@/components/StatusRibbon.vue'
import SettingsDrawer from '@/components/SettingsDrawer.vue'

const store = useAppStore()
let disposeInit: (() => void) | null = null

const settingsOpen = ref(false)
const settingsAnchorRef = ref<HTMLDivElement | null>(null)

// ConsoleDrawer の開閉状態と高さ（px）
const consoleOpen = ref(true)
const consoleH = ref(160)
const CONSOLE_H_MIN = 80
const VISUALIZER_H_MIN = 100
let resizing = false
let resizeStartY = 0
let resizeStartH = 0

function onResizerPointerDown(event: PointerEvent): void {
  resizing = true
  resizeStartY = event.clientY
  resizeStartH = consoleH.value
  ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
}

function onResizerPointerMove(event: PointerEvent): void {
  if (!resizing) return
  const dy = resizeStartY - event.clientY
  const contentH = (event.currentTarget as HTMLElement | null)?.closest('.content')?.clientHeight
  const maxH = contentH ? contentH - VISUALIZER_H_MIN - 5 : 600
  consoleH.value = Math.max(CONSOLE_H_MIN, Math.min(maxH, resizeStartH + dy))
}

function onResizerPointerUp(): void {
  resizing = false
}

function onBodyClick(event: MouseEvent): void {
  if (!settingsOpen.value) return
  if (settingsAnchorRef.value?.contains(event.target as Node)) return
  settingsOpen.value = false
}

onMounted(() => {
  disposeInit = store.init()
})
onUnmounted(() => {
  disposeInit?.()
})
</script>

<template>
  <div class="app">
    <TopToolbar @toggle-settings="settingsOpen = !settingsOpen" />
    <div class="body" @click="onBodyClick">
      <LeftPanel />
      <div class="content">
        <VisualizerPanel style="flex: 1 1 auto; min-height: 0;" />
        <div
          v-if="consoleOpen"
          class="resizer"
          @pointerdown="onResizerPointerDown"
          @pointermove="onResizerPointerMove"
          @pointerup="onResizerPointerUp"
          @pointercancel="onResizerPointerUp"
        />
        <ConsoleDrawer
          :style="{ flex: 'none', height: `${consoleOpen ? consoleH : 30}px` }"
          @update:open="consoleOpen = $event"
        />
      </div>
      <div v-if="settingsOpen" ref="settingsAnchorRef" class="settingsAnchor">
        <SettingsDrawer @close="settingsOpen = false" />
      </div>
    </div>
    <StatusRibbon />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.body {
  position: relative;
  flex: 1;
  display: flex;
  min-height: 0;
}
.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.resizer {
  flex: none;
  height: 5px;
  background-color: var(--border);
  cursor: ns-resize;
  user-select: none;
}
.resizer:hover {
  background-color: var(--ts);
  opacity: 0.4;
}
.settingsAnchor {
  position: absolute;
  right: 0;
  top: 0;
}
</style>
