<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/appStore'
import { useGcodeFileStore } from '@/stores/gcodeFileStore'
import { useIpc } from '@/composables/useIpc'

const store = useAppStore()
const gcodeFile = useGcodeFileStore()
const ipc = useIpc()
const fileInput = ref<HTMLInputElement | null>(null)

const progressPercent = computed(() => {
  if (store.job.totalLines === 0) return 0
  return Math.round((store.job.currentLine / store.job.totalLines) * 100)
})

function pickFile(): void {
  fileInput.value?.click()
}

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    gcodeFile.load(file.name, String(reader.result ?? ''))
  }
  reader.readAsText(file)
  input.value = ''
}

function run(): void {
  if (gcodeFile.lines.length === 0) return
  ipc.runFile(gcodeFile.lines)
}
</script>

<template>
  <section class="panel">
    <h2 class="title">ジョブ実行</h2>
    <div class="row">
      <button class="iconButton" @click="pickFile">ファイルを開く</button>
      <span class="fileName">{{ gcodeFile.fileName || 'ファイル未選択' }}</span>
      <input
        ref="fileInput"
        class="hiddenInput"
        type="file"
        accept=".gcode,.nc,.ngc,.txt"
        @change="onFileChange"
      />
    </div>

    <div class="progress">
      <div class="progressTrack">
        <div class="progressFill" :style="{ width: `${progressPercent}%` }" />
      </div>
      <span class="progressLabel">
        {{ store.job.currentLine }} / {{ store.job.totalLines }} ({{ progressPercent }}%)
      </span>
    </div>

    <div class="row">
      <button
        class="primaryButton"
        :disabled="!store.connection.connected || store.job.running || gcodeFile.lines.length === 0"
        @click="run"
      >
        実行
      </button>
      <button class="iconButton" :disabled="!store.job.running || store.job.paused" @click="ipc.pause()">
        一時停止
      </button>
      <button class="iconButton" :disabled="!store.job.running || !store.job.paused" @click="ipc.resume()">
        再開
      </button>
      <button class="iconButton" :disabled="!store.job.running" @click="ipc.cancel()">キャンセル</button>
    </div>
  </section>
</template>

<style scoped>
.panel {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
}
.row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.fileName {
  color: var(--color-text-secondary);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hiddenInput {
  display: none;
}
.progress {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.progressTrack {
  height: 6px;
  border-radius: var(--radius-sm);
  background-color: var(--color-border);
  overflow: hidden;
}
.progressFill {
  height: 100%;
  background-color: var(--color-accent);
  transition: width 0.2s ease;
}
.progressLabel {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-text-secondary);
}
.iconButton,
.primaryButton {
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  background-color: var(--color-bg);
  color: var(--color-text-primary);
}
.primaryButton {
  background-color: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-black);
  font-weight: 600;
}
.iconButton:disabled,
.primaryButton:disabled {
  opacity: 0.5;
}
</style>
