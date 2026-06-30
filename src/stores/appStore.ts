/**
 * Mainからpushされた状態を保持する唯一のPiniaストア。
 * コンポーネントは必要なスライス(connection/grbl/job/osc/console)だけを参照することで、
 * Vueの細粒度リアクティビティにより無関係な変化での再描画を避ける。
 */
import { defineStore } from 'pinia'
import { reactive } from 'vue'
import type { AppState } from '@shared/ipcContract'
import { initialAppState } from '@shared/ipcContract'
import { useIpc } from '@/composables/useIpc'

export const useAppStore = defineStore('app', () => {
  const connection = reactive<AppState['connection']>(structuredClone(initialAppState.connection))
  const grbl = reactive<AppState['grbl']>(structuredClone(initialAppState.grbl))
  const job = reactive<AppState['job']>(structuredClone(initialAppState.job))
  const osc = reactive<AppState['osc']>(structuredClone(initialAppState.osc))
  const consoleState = reactive<AppState['console']>(structuredClone(initialAppState.console))

  // Renderer-only serial form state — persists across Settings Drawer open/close cycles
  const serialForm = reactive({ path: '', baudRate: 115200, pollIntervalMs: 100 })

  let unsubscribe: (() => void) | null = null

  function applyState(next: AppState): void {
    Object.assign(connection, next.connection)
    Object.assign(grbl, next.grbl)
    Object.assign(job, next.job)
    Object.assign(osc, next.osc)
    Object.assign(consoleState, next.console)
  }

  /** App.vueのonMountedから一度だけ呼ぶ。返り値はunmount時に呼ぶ解除関数 */
  function init(): () => void {
    if (!unsubscribe) {
      unsubscribe = useIpc().onState(applyState)
    }
    return () => {
      unsubscribe?.()
      unsubscribe = null
    }
  }

  return { connection, grbl, job, osc, console: consoleState, serialForm, init }
})
