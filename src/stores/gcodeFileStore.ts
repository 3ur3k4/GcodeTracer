/**
 * 読み込んだGコードファイルの内容を保持するRenderer専用ストア。
 * Main(grbl/state.ts)が保持するAppStateとは無関係(ジョブ送信前のローカルなドラフトに過ぎない)。
 * JobPanel.vue(送信)とVisualizerPanel.vue(可視化)の両方から参照される。
 *
 * toolPath/segmentLines をここで保持することで、VisualizerPanel と GcodeTextPanel が
 * 同一の計算結果を共有し、gcodeToPath の二重呼び出しを防ぐ。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { gcodeToPath } from '@/lib/gcodeToPath'
import type { ToolPath } from '@/lib/gcodeToPath'

export const useGcodeFileStore = defineStore('gcodeFile', () => {
  const fileName = ref('')
  const lines = ref<string[]>([])
  const resumeFromLine = ref(0)

  // プレビューモード状態 (Renderer専用・IPCに乗せない)
  const previewActive = ref(false)
  const previewLine = ref(0)

  // ツールパス (VisualizerPanel と GcodeTextPanel で共有)
  const toolPath = computed<ToolPath>(() => gcodeToPath(lines.value))

  // セグメントが存在するソース行番号の昇順リスト(重複排除済み)
  const segmentLines = computed<number[]>(() => {
    const set = new Set(toolPath.value.segments.map((s) => s.sourceLine))
    return Array.from(set).sort((a, b) => a - b)
  })

  function load(name: string, text: string): void {
    fileName.value = name
    lines.value = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
    resumeFromLine.value = 0
    previewActive.value = false
    previewLine.value = 0
  }

  function clear(): void {
    fileName.value = ''
    lines.value = []
    resumeFromLine.value = 0
    previewActive.value = false
    previewLine.value = 0
  }

  function saveResumePoint(line: number): void {
    resumeFromLine.value = line
  }

  function clearResumePoint(): void {
    resumeFromLine.value = 0
  }

  function togglePreview(): void {
    if (previewActive.value) {
      previewActive.value = false
    } else {
      previewLine.value = lines.value.length
      previewActive.value = true
    }
  }

  function setPreviewLine(line: number): void {
    previewLine.value = Math.max(0, Math.min(line, lines.value.length))
    previewActive.value = true
  }

  function stepNext(): void {
    const sl = segmentLines.value
    const next = sl.find((l) => l >= previewLine.value)
    previewLine.value = next !== undefined ? next + 1 : lines.value.length
  }

  function stepPrev(): void {
    const sl = segmentLines.value
    let prev: number | undefined
    for (let i = sl.length - 1; i >= 0; i--) {
      if (sl[i] < previewLine.value) {
        prev = sl[i]
        break
      }
    }
    previewLine.value = prev !== undefined ? prev : 0
  }

  return {
    fileName,
    lines,
    resumeFromLine,
    previewActive,
    previewLine,
    toolPath,
    segmentLines,
    load,
    clear,
    saveResumePoint,
    clearResumePoint,
    togglePreview,
    setPreviewLine,
    stepNext,
    stepPrev,
  }
})
