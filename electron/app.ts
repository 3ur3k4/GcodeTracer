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

const JOG_FEED_RATE_MM_PER_MIN = 1000

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
      const dx = (x * stepSize).toFixed(3)
      const dy = (y * stepSize).toFixed(3)
      const dz = (z * stepSize).toFixed(3)
      scheduler.enqueue(`$J=G91 G21 X${dx} Y${dy} Z${dz} F${JOG_FEED_RATE_MM_PER_MIN}`)
    },

    zero(axis) {
      scheduler?.enqueue(`G10 L20 P0 ${axis}0`)
    },

    home() {
      scheduler?.enqueue('$H')
    },

    unlock() {
      scheduler?.enqueue('$X')
    },

    softReset() {
      scheduler?.softReset()
    },

    runFile(lines) {
      jobRunner?.start(lines)
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
