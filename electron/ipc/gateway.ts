/**
 * Renderer⇄Mainの唯一の境界。全Renderer→Mainメッセージをzodで検証し、不正値は拒否する。
 * Main→Rendererの状態pushも、ここから1本のチャンネルのみで配信する(変更があった場合のみ・間引いて送る)。
 */
import { ipcMain, type BrowserWindow, type IpcMainEvent } from 'electron'
import {
  IPC_CHANNELS,
  rendererToMainMessageSchema,
  type AppState,
  type PortInfo,
  type RendererToMainMessage,
} from '../../shared/ipcContract'
import type { GrblState } from '../grbl/state'

export interface GatewayHandlers {
  connect(path: string, baudRate: number): void | Promise<void>
  disconnect(): void | Promise<void>
  sendCommand(command: string): void
  jog(x: number, y: number, z: number, stepSize: number): void
  zero(axis: 'X' | 'Y' | 'Z'): void
  gotoWorkZero(): void
  home(): void
  unlock(): void
  softReset(): void
  runFile(lines: string[], startLine: number): void
  pause(): void
  resume(): void
  cancel(): void
  setPollInterval(ms: number): void
  updateOscSettings(ip: string, port: number, enabled: boolean): void
  listPorts(): Promise<PortInfo[]>
}

const DEFAULT_PUSH_INTERVAL_MS = 100

export class IpcGateway {
  private readonly win: BrowserWindow
  private readonly state: GrblState
  private readonly handlers: GatewayHandlers
  private readonly pushIntervalMs: number

  private unsubscribeState: (() => void) | null = null
  private pushTimer: ReturnType<typeof setTimeout> | null = null
  private pendingState: AppState | null = null
  private lastPushedJson = ''
  private lastFlushAt = 0

  constructor(win: BrowserWindow, state: GrblState, handlers: GatewayHandlers, pushIntervalMs = DEFAULT_PUSH_INTERVAL_MS) {
    this.win = win
    this.state = state
    this.handlers = handlers
    this.pushIntervalMs = pushIntervalMs
  }

  start(): void {
    ipcMain.on(IPC_CHANNELS.dispatch, this.onDispatch)
    ipcMain.handle(IPC_CHANNELS.listPorts, () => this.handlers.listPorts())
    this.unsubscribeState = this.state.onChange((state) => this.schedulePush(state))
    this.schedulePush(this.state.getState())
  }

  stop(): void {
    ipcMain.removeListener(IPC_CHANNELS.dispatch, this.onDispatch)
    ipcMain.removeHandler(IPC_CHANNELS.listPorts)
    this.unsubscribeState?.()
    this.unsubscribeState = null
    if (this.pushTimer) {
      clearTimeout(this.pushTimer)
      this.pushTimer = null
    }
  }

  private onDispatch = (_event: IpcMainEvent, raw: unknown): void => {
    const parsed = rendererToMainMessageSchema.safeParse(raw)
    if (!parsed.success) {
      this.state.appendConsoleLine('info', `不正なメッセージを拒否しました: ${parsed.error.message}`)
      return
    }
    void this.handleMessage(parsed.data)
  }

  private async handleMessage(message: RendererToMainMessage): Promise<void> {
    try {
      switch (message.type) {
        case 'connect':
          await this.handlers.connect(message.path, message.baudRate)
          break
        case 'disconnect':
          await this.handlers.disconnect()
          break
        case 'send-command':
          this.handlers.sendCommand(message.command)
          break
        case 'jog':
          this.handlers.jog(message.x, message.y, message.z, message.stepSize)
          break
        case 'zero':
          this.handlers.zero(message.axis)
          break
        case 'goto-work-zero':
          this.handlers.gotoWorkZero()
          break
        case 'home':
          this.handlers.home()
          break
        case 'unlock':
          this.handlers.unlock()
          break
        case 'soft-reset':
          this.handlers.softReset()
          break
        case 'run-file':
          this.handlers.runFile(message.lines, message.startLine)
          break
        case 'pause':
          this.handlers.pause()
          break
        case 'resume':
          this.handlers.resume()
          break
        case 'cancel':
          this.handlers.cancel()
          break
        case 'set-poll-interval':
          this.handlers.setPollInterval(message.ms)
          break
        case 'update-osc-settings':
          this.handlers.updateOscSettings(message.ip, message.port, message.enabled)
          break
      }
    } catch (err) {
      this.state.appendConsoleLine('info', `操作の処理中にエラーが発生しました: ${String(err)}`)
    }
  }

  private schedulePush(state: AppState): void {
    const json = JSON.stringify(state)
    if (json === this.lastPushedJson) return
    this.pendingState = state

    const elapsed = Date.now() - this.lastFlushAt
    if (elapsed >= this.pushIntervalMs) {
      this.flushPush()
    } else if (!this.pushTimer) {
      this.pushTimer = setTimeout(() => this.flushPush(), this.pushIntervalMs - elapsed)
    }
  }

  private flushPush(): void {
    this.pushTimer = null
    if (!this.pendingState) return
    const json = JSON.stringify(this.pendingState)
    if (json !== this.lastPushedJson) {
      this.lastPushedJson = json
      this.lastFlushAt = Date.now()
      this.win.webContents.send(IPC_CHANNELS.stateChanged, this.pendingState)
    }
    this.pendingState = null
  }
}
