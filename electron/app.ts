/**
 * コンポジションルート。各モジュールを外部依存として注入し、実際の結線(wiring)のみを行う。
 * main.tsから分離することで、テスト時はcreateTransportにMockTransportを注入できるようにする(8.3節)。
 */
import type { BrowserWindow } from 'electron'
import { GrblState } from './grbl/state'
import { GrblParser } from './grbl/parser'
import { GrblScheduler } from './grbl/scheduler'
import { JobRunner } from './job/jobRunner'
import { OscBridge } from './osc/oscBridge'
import { IpcGateway, type GatewayHandlers } from './ipc/gateway'
import type { Transport } from './serial/transport'


export interface AppDeps {
  win: BrowserWindow
  createTransport: () => Transport
}

export interface App {
  dispose(): Promise<void>
}

export function createApp(deps: AppDeps): App {
  const state = new GrblState()
  const oscBridge = new OscBridge(state)
  oscBridge.start()

  let transport: Transport | null = null
  let parser: GrblParser | null = null
  let scheduler: GrblScheduler | null = null
  let jobRunner: JobRunner | null = null

  function teardownConnection(): void {
    scheduler?.stopPolling()
    transport = null
    parser = null
    scheduler = null
    jobRunner = null
  }

  const handlers: GatewayHandlers = {
    async listPorts() {
      return deps.createTransport().list()
    },

    async connect(path, baudRate) {
      if (transport) return
      const t = deps.createTransport()
      try {
        await t.open(path, baudRate)
      } catch (err) {
        state.appendConsoleLine('info', `接続に失敗しました: ${String(err)}`)
        return
      }

      transport = t
      parser = new GrblParser()
      scheduler = new GrblScheduler(t)
      jobRunner = new JobRunner(scheduler, state)

      t.onData((chunk) => {
        const events = parser!.feed(chunk)
        for (const event of events) {
          state.applyGrblEvent(event)
          if (event.type === 'status') scheduler!.notifyStatusReceived()
          else if (event.type === 'ok') scheduler!.onAck({ ok: true })
          else if (event.type === 'error') scheduler!.onAck({ ok: false, code: event.code })
        }
      })
      t.onClose(() => {
        teardownConnection()
        state.setConnection({ connected: false, port: null })
      })

      state.setConnection({ connected: true, port: path, baudRate })
      scheduler.startPolling()
    },

    async disconnect() {
      if (!transport) return
      const t = transport
      teardownConnection()
      await t.close()
      state.setConnection({ connected: false, port: null })
    },

    sendCommand(command) {
      if (!scheduler) return
      state.appendConsoleLine('tx', command)
      scheduler.enqueue(command)
    },

    jog(x, y, z, stepSize) {
      if (!scheduler) return
      const parts = ['G91', 'G0', 'G21']
      if (x !== 0) parts.push(`X${(x * stepSize).toFixed(3)}`)
      if (y !== 0) parts.push(`Y${(y * stepSize).toFixed(3)}`)
      if (z !== 0) parts.push(`Z${(z * stepSize).toFixed(3)}`)
      if (parts.length === 3) return
      const cmd = parts.join(' ')
      state.appendConsoleLine('tx', cmd)
      scheduler.enqueue(cmd)
    },

    zero(axis) {
      if (!scheduler) return
      const cmd = `G10 L20 P0 ${axis}0`
      state.appendConsoleLine('tx', cmd)
      scheduler.enqueue(cmd)
    },

    gotoWorkZero() {
      if (!scheduler) return
      state.appendConsoleLine('tx', 'G0 X0 Y0 Z0')
      scheduler.enqueue('G0 X0 Y0 Z0')
    },

    home() {
      if (!scheduler) return
      state.appendConsoleLine('tx', '$H')
      scheduler.enqueue('$H')
    },

    unlock() {
      if (!scheduler) return
      state.appendConsoleLine('tx', '$X')
      scheduler.enqueue('$X')
    },

    softReset() {
      if (!scheduler) return
      state.appendConsoleLine('tx', '\x18 (soft reset)')
      scheduler.softReset()
    },

    runFile(lines, startLine) {
      jobRunner?.start(lines, startLine)
    },

    pause() {
      jobRunner?.pause()
      scheduler?.feedHold()
    },

    resume() {
      jobRunner?.resume()
      scheduler?.cycleStartResume()
    },

    cancel() {
      jobRunner?.cancel()
    },

    setPollInterval(ms) {
      scheduler?.setPollInterval(ms)
    },

    updateOscSettings(ip, port, enabled) {
      state.setOscSettings({ ip, port, enabled })
    },
  }

  const gateway = new IpcGateway(deps.win, state, handlers)
  gateway.start()

  return {
    async dispose() {
      gateway.stop()
      oscBridge.stop()
      if (transport) await transport.close()
    },
  }
}
