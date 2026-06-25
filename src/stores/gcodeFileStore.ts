/**
 * 読み込んだGコードファイルの内容を保持するRenderer専用ストア。
 * Main(grbl/state.ts)が保持するAppStateとは無関係(ジョブ送信前のローカルなドラフトに過ぎない)。
 * JobPanel.vue(送信)とVisualizerPanel.vue(可視化)の両方から参照される。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useGcodeFileStore = defineStore('gcodeFile', () => {
  const fileName = ref('')
  const lines = ref<string[]>([])
  const resumeFromLine = ref(0)

  function load(name: string, text: string): void {
    fileName.value = name
    lines.value = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
    resumeFromLine.value = 0
  }

  function clear(): void {
    fileName.value = ''
    lines.value = []
    resumeFromLine.value = 0
  }

  function saveResumePoint(line: number): void {
    resumeFromLine.value = line
  }

  function clearResumePoint(): void {
    resumeFromLine.value = 0
  }

  return { fileName, lines, resumeFromLine, load, clear, saveResumePoint, clearResumePoint }
})
