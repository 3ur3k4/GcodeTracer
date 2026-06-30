/**
 * appState(AppState)を集約・保持する唯一の場所(Single Source of Truth)。
 * - grbl/parser.tsが発行する構造化イベントを取り込み、機械状態・座標を更新する。
 * - WCO(ワーク座標オフセット)はGRBLの全ステータス報告に毎回含まれるとは限らないため、
 *   直近の値をここでキャッシュしWPosを導出する(parser.tsはステートレスに保つため、この記憶はstate.tsの責務)。
 * - 内部状態への直接アクセス(例: state['state'])は禁止。getState()が返すのは常にスナップショットのコピー。
 */
import { EventEmitter } from 'node:events'
import type { AppState, ConsoleLine } from '../../shared/ipcContract'
import { initialAppState } from '../../shared/ipcContract'
import type { GrblEvent, Position } from './parser'
import { formatAlarmCode, formatErrorCode } from './errors'

const MAX_CONSOLE_LINES = 500

function subtract(a: Position, b: Position): Position {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

export class GrblState {
  private state: AppState
  private lastWco: Position | null = null
  private nextConsoleId = 1
  private emitter = new EventEmitter()

  constructor(initial: AppState = structuredClone(initialAppState)) {
    this.state = initial
  }

  getState(): AppState {
    return structuredClone(this.state)
  }

  onChange(listener: (state: AppState) => void): () => void {
    this.emitter.on('change', listener)
    return () => this.emitter.off('change', listener)
  }

  setConnection(patch: Partial<AppState['connection']>): void {
    this.state.connection = { ...this.state.connection, ...patch }
    this.notify()
  }

  setJobProgress(patch: Partial<AppState['job']>): void {
    this.state.job = { ...this.state.job, ...patch }
    this.notify()
  }

  setOscSettings(patch: Partial<AppState['osc']>): void {
    this.state.osc = { ...this.state.osc, ...patch }
    this.notify()
  }

  appendConsoleLine(direction: ConsoleLine['direction'], text: string, isError = false): void {
    this.state.console.lines.push({ id: this.nextConsoleId++, direction, text, timestamp: Date.now() })
    if (this.state.console.lines.length > MAX_CONSOLE_LINES) this.state.console.lines.shift()
    if (isError) this.state.console.hasError = true
    this.notify()
  }

  applyGrblEvent(event: GrblEvent): void {
    switch (event.type) {
      case 'status': {
        if (this.state.grbl.machineState === 'Alarm' && event.machineState !== 'Alarm') {
          this.state.console.hasError = false
        }
        this.state.grbl.machineState = event.machineState
        if (event.wco) this.lastWco = event.wco
        if (event.mpos) {
          this.state.grbl.mpos = event.mpos
          if (event.wpos) {
            this.state.grbl.wpos = event.wpos
          } else if (this.lastWco) {
            this.state.grbl.wpos = subtract(event.mpos, this.lastWco)
          }
        } else if (event.wpos) {
          this.state.grbl.wpos = event.wpos
        }
        break
      }
      case 'ok':
        this.appendConsoleLine('rx', 'ok')
        return // appendConsoleLineが既にnotify済み
      case 'error':
        this.appendConsoleLine('rx', `error:${event.code} ${formatErrorCode(event.code)}`, true)
        return
      case 'alarm':
        this.state.grbl.machineState = 'Alarm'
        this.appendConsoleLine('rx', `ALARM:${event.code} ${formatAlarmCode(event.code)}`, true)
        return
      case 'feedback':
        this.appendConsoleLine('rx', `[${event.message}]`)
        return
      case 'welcome':
        this.appendConsoleLine('info', event.raw)
        return
      case 'unknown':
        this.appendConsoleLine('rx', event.raw)
        return
    }
    this.notify()
  }

  private notify(): void {
    this.emitter.emit('change', this.getState())
  }
}
