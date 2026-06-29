/**
 * window.api(preloadが公開する唯一の境界)の薄いラッパー。
 * コンポーネントはここを経由してのみMainへ操作をdispatchする(シリアル生データへの直接アクセスは行わない)。
 */
import type { AppState, PortInfo, RendererToMainMessage } from '@shared/ipcContract'

function dispatch(message: RendererToMainMessage): void {
  window.api.dispatch(message)
}

export function useIpc() {
  return {
    onState(callback: (state: AppState) => void): () => void {
      return window.api.onState(callback)
    },
    listPorts(): Promise<PortInfo[]> {
      return window.api.listPorts()
    },
    connect(path: string, baudRate: number): void {
      dispatch({ type: 'connect', path, baudRate })
    },
    disconnect(): void {
      dispatch({ type: 'disconnect' })
    },
    sendCommand(command: string): void {
      dispatch({ type: 'send-command', command })
    },
    jog(x: number, y: number, z: number, stepSize: number): void {
      dispatch({ type: 'jog', x, y, z, stepSize })
    },
    zero(axis: 'X' | 'Y' | 'Z'): void {
      dispatch({ type: 'zero', axis })
    },
    gotoWorkZero(): void {
      dispatch({ type: 'goto-work-zero' })
    },
    home(): void {
      dispatch({ type: 'home' })
    },
    unlock(): void {
      dispatch({ type: 'unlock' })
    },
    softReset(): void {
      dispatch({ type: 'soft-reset' })
    },
    runFile(lines: string[], startLine = 0): void {
      dispatch({ type: 'run-file', lines: Array.from(lines), startLine })
    },
    pause(): void {
      dispatch({ type: 'pause' })
    },
    resume(): void {
      dispatch({ type: 'resume' })
    },
    cancel(): void {
      dispatch({ type: 'cancel' })
    },
    setPollInterval(ms: number): void {
      dispatch({ type: 'set-poll-interval', ms })
    },
    updateOscSettings(ip: string, port: number, enabled: boolean): void {
      dispatch({ type: 'update-osc-settings', ip, port, enabled })
    },
    revealFile(filePath: string): void {
      dispatch({ type: 'reveal-file', filePath })
    },
  }
}
