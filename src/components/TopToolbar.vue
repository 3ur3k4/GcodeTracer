<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAppStore } from '@/stores/appStore'
import { useGcodeFileStore } from '@/stores/gcodeFileStore'
import { useIpc } from '@/composables/useIpc'
import { FolderOpen, Pause, Play, Settings, Square, TriangleAlert } from '@lucide/vue'

defineEmits<{ 'toggle-settings': [] }>()

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
    <button class="iconButton" aria-label="ファイルを開く" @click="openFile">
      <FolderOpen :size="17" :stroke-width="1.75" />
    </button>
    <input ref="fileInput" class="hiddenInput" type="file" accept=".gcode,.nc,.ngc,.txt" @change="onFileChange" />

    <button class="iconButton runButton" aria-label="実行" :disabled="!runActive" @click="runOrResume">
      <Play :size="17" :stroke-width="1.75" />
    </button>
    <button class="iconButton" aria-label="一時停止" :disabled="!pauseActive" @click="pause">
      <Pause :size="17" :stroke-width="1.75" />
    </button>
    <button class="iconButton" aria-label="停止" :disabled="!stopActive" @click="stop">
      <Square :size="17" :stroke-width="1.75" />
    </button>

    <div class="separator" />

    <button class="iconButton dangerButton" aria-label="ソフトリセット" @click="ipc.softReset()">
      <TriangleAlert :size="17" :stroke-width="1.75" />
    </button>

    <div class="spacer" />

    <span v-if="hasResumePoint && !store.job.running" class="resumeLabel">
      {{ gcodeFile.resumeFromLine }}行目から再開
      <button class="resetButton" @click="gcodeFile.clearResumePoint()">✕</button>
    </span>

    <div v-if="store.job.running" class="progress">
      <div class="progressTrack">
        <div class="progressFill" :style="{ width: `${progressPercent * 100}%` }" />
      </div>
      <span class="progressLabel">{{ store.job.currentLine }} / {{ store.job.totalLines }}</span>
    </div>

    <button class="iconButton settingsButton" aria-label="設定" @click="$emit('toggle-settings')">
      <Settings :size="17" :stroke-width="1.75" />
    </button>
  </header>
</template>

<style scoped>
.toolbar {
  height: 46px;
  flex: none;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0 var(--space-2);
  background-color: var(--surface);
  border-bottom: 1px solid var(--border);
}
.hiddenInput {
  display: none;
}
.iconButton {
  width: 36px;
  height: 34px;
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
  border-color: var(--accent);
  color: var(--accent);
}
.dangerButton {
  border-color: var(--danger);
  color: var(--danger);
}
.separator {
  width: 1px;
  height: 24px;
  background-color: var(--border);
  margin: 0 var(--space-1);
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
