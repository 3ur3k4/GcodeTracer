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

  function load(name: string, text: string): void {
    fileName.value = name
    lines.value = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  }

  function clear(): void {
    fileName.value = ''
    lines.value = []
  }

  return { fileName, lines, load, clear }
})
