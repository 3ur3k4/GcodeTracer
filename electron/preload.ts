/**
 * contextBridgeで`window.api`のみを公開する。Node API・ipcRendererそのものはRendererに渡さない。
 */
import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC_CHANNELS } from '../shared/ipcContract'
import type { AppState, PortInfo, RendererToMainMessage } from '../shared/ipcContract'

const api = {
  dispatch(message: RendererToMainMessage): void {
    ipcRenderer.send(IPC_CHANNELS.dispatch, message)
  },
  onState(callback: (state: AppState) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, state: AppState) => callback(state)
    ipcRenderer.on(IPC_CHANNELS.stateChanged, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.stateChanged, listener)
  },
  listPorts(): Promise<PortInfo[]> {
    return ipcRenderer.invoke(IPC_CHANNELS.listPorts)
  },
  onFullscreen(callback: (isFullscreen: boolean) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, value: boolean) => callback(value)
    ipcRenderer.on(IPC_CHANNELS.fullscreenChanged, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.fullscreenChanged, listener)
  },
  getPathForFile(file: File): string {
    return webUtils.getPathForFile(file)
  },
}

export type GcodeTracerApi = typeof api

contextBridge.exposeInMainWorld('api', api)
