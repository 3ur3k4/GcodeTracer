<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useAppStore } from '@/stores/appStore'
import { useGcodeFileStore } from '@/stores/gcodeFileStore'
import { useIpc } from '@/composables/useIpc'
import { FolderOpen, Home, Lock, LockOpen, Pause, Play, Settings, Square, TriangleAlert } from '@lucide/vue'
import AppTooltip from '@/components/AppTooltip.vue'

defineEmits<{ 'toggle-settings': [] }>()

const isFullscreen = ref(false)
let disposeFullscreen: (() => void) | null = null
onMounted(() => {
  disposeFullscreen = window.api.onFullscreen((v) => { isFullscreen.value = v })
})
onUnmounted(() => {
  disposeFullscreen?.()
})

const store = useAppStore()
const gcodeFile = useGcodeFileStore()
const ipc = useIpc()
const fileInput = ref<HTMLInputElement | null>(null)

const runActive = computed(() =>
  store.connection.connected &&
  (store.job.paused || (!store.job.running && gcodeFile.lines.length > 0)),
)
const hasResumePoint = computed(() => gcodeFile.resumeFromLine > 0)

// ジョブが停止したとき(完走でなく途中停止)に再開ポイントを保存する
watch(
  () => store.job.running,
  (running, wasRunning) => {
    if (!running && wasRunning) {
      const stopped = store.job.currentLine
      const total = store.job.totalLines
      if (stopped > 0 && stopped < total) {
        gcodeFile.saveResumePoint(stopped)
      } else {
        gcodeFile.clearResumePoint()
      }
    }
  },
)
const pauseActive = computed(() => store.grbl.machineState === 'Run')
const stopActive = computed(() => store.grbl.machineState === 'Run' || store.grbl.machineState === 'Hold')
const isLocked = computed(() => store.grbl.machineState === 'Alarm')

const progressPercent = computed(() => {
  if (store.job.totalLines === 0) return 0
  return store.job.currentLine / store.job.totalLines
})

function openFile(): void {
  fileInput.value?.click()
}

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    if (store.job.running || store.job.paused) ipc.cancel()
    gcodeFile.load(file.name, String(reader.result ?? ''))
  }
  reader.readAsText(file)
  input.value = ''
}

function runOrResume(): void {
  if (!store.connection.connected) return
  if (store.job.paused) {
    ipc.resume()
  } else if (!store.job.running && gcodeFile.lines.length > 0) {
    ipc.runFile(gcodeFile.lines, gcodeFile.resumeFromLine)
  }
}

function pause(): void {
  if (!pauseActive.value) return
  ipc.pause()
}

function stop(): void {
  if (!stopActive.value) return
  ipc.cancel()
}
</script>

<template>
  <header class="toolbar">
    <span class="appName" :class="{ fullscreen: isFullscreen }">Gcode Tracer</span>
    <div class="separator" />
    <AppTooltip text="GCodeファイルを開く">
      <button class="iconButton" aria-label="ファイルを開く" @click="openFile">
        <FolderOpen :size="17" :stroke-width="1.75" />
      </button>
    </AppTooltip>
    <input ref="fileInput" class="hiddenInput" type="file" accept=".gcode,.nc,.ngc,.txt" @change="onFileChange" />
    <AppTooltip text="実行 / 再開">
      <button class="iconButton runButton" aria-label="実行" :disabled="!runActive" @click="runOrResume">
        <Play :size="17" :stroke-width="1.75" />
      </button>
    </AppTooltip>
    <AppTooltip text="一時停止" sub="! (Feed Hold)">
      <button class="iconButton" aria-label="一時停止" :disabled="!pauseActive" @click="pause">
        <Pause :size="17" :stroke-width="1.75" />
      </button>
    </AppTooltip>
    <AppTooltip text="停止 (キャンセル)">
      <button class="iconButton" aria-label="停止" :disabled="!stopActive" @click="stop">
        <Square :size="17" :stroke-width="1.75" />
      </button>
    </AppTooltip>

    <div class="separator" />

    <AppTooltip text="ホーミング" sub="$H">
      <button class="iconButton" :disabled="!store.connection.connected" aria-label="ホーミング ($H)" @click="ipc.home()">
        <Home :size="17" :stroke-width="1.75" />
      </button>
    </AppTooltip>
    <AppTooltip :text="isLocked ? 'アンロック (Alarm状態を解除)' : 'ロック解除済み'" :sub="isLocked ? '$X' : undefined">
      <button
        class="iconButton"
        :class="{ warningButton: isLocked }"
        :disabled="!store.connection.connected"
        :aria-label="isLocked ? 'アンロック ($X)' : 'ロック解除済み'"
        @click="isLocked ? ipc.unlock() : undefined"
      >
        <Lock v-if="isLocked" :size="17" :stroke-width="1.75" />
        <LockOpen v-else :size="17" :stroke-width="1.75" />
      </button>
    </AppTooltip>

    <div class="separator" />

    <AppTooltip text="ソフトリセット" sub="Ctrl-X">
      <button class="iconButton dangerButton" aria-label="ソフトリセット (Ctrl-X)" @click="ipc.softReset()">
        <TriangleAlert :size="17" :stroke-width="1.75" />
      </button>
    </AppTooltip>

    <div class="spacer" />

    <span v-if="hasResumePoint && !store.job.running" class="resumeLabel">
      {{ gcodeFile.resumeFromLine }}行目から再開
      <button class="resetButton" @click="gcodeFile.clearResumePoint()">✕</button>
    </span>

    <div v-if="store.job.running" class="progress">
      <div class="progressTrack">
        <div class="progressFill" :style="{ width: `${progressPercent * 100}%` }" />
      </div>
      <span class="progressLabel">{{ Math.round(progressPercent * 100) }}% ({{ store.job.currentLine }} / {{ store.job.totalLines }})</span>
    </div>

    <AppTooltip text="設定">
      <button class="iconButton settingsButton" aria-label="設定" @click="$emit('toggle-settings')">
        <Settings :size="17" :stroke-width="1.75" />
      </button>
    </AppTooltip>
  </header>
</template>

<style scoped>
.toolbar {
  height: 46px;
  flex: none;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-2) 0 0;
  background-color: var(--surface);
  border-bottom: 1px solid var(--border);
  -webkit-app-region: drag;
}
.toolbar :deep(button),
.toolbar :deep(input) {
  -webkit-app-region: no-drag;
}
.appName {
  padding-left: 90px;
  padding-right: 14px;
  font-size: 16px;
  font-weight: 400;
  color: var(--tp);
  white-space: nowrap;
  letter-spacing: 0.01em;
  font-family: var(--font-mono);
  font-style: italic;
}
.appName.fullscreen {
  padding: 0;
  width: 221px;
  text-align: center;
}
.hiddenInput {
  display: none;
}
.iconButton {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--tp);
}
.iconButton:hover:not(:disabled) {
  background-color: var(--surface2);
}
.iconButton:active:not(:disabled) {
  transform: scale(0.94);
}
.iconButton:disabled {
  opacity: 0.3;
  pointer-events: none;
}
.runButton {
  background-color: var(--accent);
  border-color: var(--accent);
  color: var(--surface);
}
.runButton:hover:not(:disabled) {
  background-color: var(--accent);
  filter: brightness(1.12);
}
.dangerButton {
  background-color: var(--danger);
  border-color: var(--danger);
  color: var(--surface);
}
.dangerButton:hover:not(:disabled) {
  background-color: var(--danger);
  filter: brightness(1.15);
}
.warningButton {
  border-color: var(--warning);
  color: var(--warning);
}
.separator {
  width: 1px;
  height: 24px;
  background-color: var(--border);
  flex: none;
}
.spacer {
  flex: 1;
}
.resumeLabel {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--warning);
}
.resetButton {
  border: none;
  background: none;
  color: var(--ts);
  font-size: 10px;
  padding: 0 2px;
  cursor: pointer;
}
.resetButton:hover {
  color: var(--tp);
}
.progress {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.progressTrack {
  width: 110px;
  height: 2px;
  background-color: var(--border);
}
.progressFill {
  height: 100%;
  background-color: var(--accent);
}
.progressLabel {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ts);
  white-space: nowrap;
}
.settingsButton {
  margin-left: var(--space-1);
  border-color: transparent;
  color: var(--ts);
}
.settingsButton:hover {
  color: var(--tp);
}
</style>
