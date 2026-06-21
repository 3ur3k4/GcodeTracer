/**
 * grbl/state.ts の状態変化を購読し、ワーク座標(WPos)をOSCで送信するのみを担う。
 * Renderer描画レートとは無関係に、状態が変化した時点で即座に送信する。
 */
import { UDPPort } from 'osc'
import type { GrblState } from '../grbl/state'
import type { AppState } from '../../shared/ipcContract'

export class OscBridge {
  private readonly state: GrblState
  private unsubscribe: (() => void) | null = null
  private port: UDPPort | null = null
  private portReady = false
  private appliedSettings: AppState['osc'] | null = null
  private lastSentKey = ''

  constructor(state: GrblState) {
    this.state = state
  }

  start(): void {
    this.unsubscribe = this.state.onChange((appState) => this.handleChange(appState))
  }

  stop(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
    this.closePort()
  }

  private handleChange(appState: AppState): void {
    this.syncPort(appState.osc)
    if (!appState.osc.enabled || !this.portReady || !this.port) return

    const { wpos } = appState.grbl
    const key = `${wpos.x},${wpos.y},${wpos.z}`
    if (key === this.lastSentKey) return
    this.lastSentKey = key

    this.port.send(
      {
        address: '/gcodeTracer/position',
        args: [
          { type: 'f', value: wpos.x },
          { type: 'f', value: wpos.y },
          { type: 'f', value: wpos.z },
        ],
      },
      appState.osc.ip,
      appState.osc.port,
    )
  }

  private syncPort(settings: AppState['osc']): void {
    const sameTarget =
      this.appliedSettings?.ip === settings.ip && this.appliedSettings?.port === settings.port
    if (this.appliedSettings?.enabled === settings.enabled && sameTarget) return
    this.appliedSettings = settings

    this.closePort()
    if (!settings.enabled) return

    const port = new UDPPort({ localAddress: '0.0.0.0', localPort: 0, metadata: true })
    port.on('ready', () => {
      this.portReady = true
    })
    port.open()
    this.port = port
  }

  private closePort(): void {
    this.port?.close()
    this.port = null
    this.portReady = false
    this.lastSentKey = ''
  }
}
