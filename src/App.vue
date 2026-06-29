<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
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
const CONSOLE_H_MIN = 40
const CONSOLE_H_DEFAULT = 160

// ヘッダークリック等で開いたとき、高さが小さすぎる場合はデフォルトに戻す
watch(consoleOpen, (open) => {
  if (open && consoleH.value < CONSOLE_H_DEFAULT) {
    consoleH.value = CONSOLE_H_DEFAULT
  }
})
const VISUALIZER_H_MIN = 100
const SNAP_OPEN_PX = 20  // 最小化状態から上方向にこの距離ドラッグするとオープンにスナップ
const contentRef = ref<HTMLDivElement | null>(null)
let resizeStartY = 0
let resizeStartH = 0

function onWindowPointerMove(event: PointerEvent): void {
  const dy = resizeStartY - event.clientY
  const contentH = contentRef.value?.clientHeight ?? 600
  const maxH = contentH - VISUALIZER_H_MIN - 5

  if (!consoleOpen.value) {
    // 最小化中: 上方向に SNAP_OPEN_PX 以上ドラッグしたらオープンにスナップ
    if (dy > SNAP_OPEN_PX) {
      consoleOpen.value = true
      consoleH.value = CONSOLE_H_MIN
      // スナップ後はここを起点に高さ調整できるよう開始点をリセット
      resizeStartY = event.clientY
      resizeStartH = CONSOLE_H_MIN
    }
    return
  }

  const newH = resizeStartH + dy
  if (newH < CONSOLE_H_MIN) {
    // CONSOLE_H_MIN を下回ったら最小化にスナップ
    consoleOpen.value = false
    return
  }
  consoleH.value = Math.min(maxH, newH)
}

function onWindowPointerUp(): void {
  window.removeEventListener('pointermove', onWindowPointerMove)
  window.removeEventListener('pointerup', onWindowPointerUp)
}

function onResizerPointerDown(event: PointerEvent): void {
  resizeStartY = event.clientY
  resizeStartH = consoleOpen.value ? consoleH.value : 0
  event.preventDefault()
  window.addEventListener('pointermove', onWindowPointerMove)
  window.addEventListener('pointerup', onWindowPointerUp)
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
      <div ref="contentRef" class="content">
        <VisualizerPanel style="flex: 1 1 auto; min-height: 0;" />
        <div class="resizer" @pointerdown="onResizerPointerDown" />
        <ConsoleDrawer
          v-model="consoleOpen"
          :style="{ flex: 'none', height: `${consoleOpen ? consoleH : 30}px` }"
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
  height: 3px;
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
