import { describe, expect, it } from 'vitest'
import { JobRunner } from './jobRunner'
import { GrblScheduler } from '../grbl/scheduler'
import { GrblState } from '../grbl/state'
import { GrblParser } from '../grbl/parser'
import { MockTransport } from '../serial/mockTransport'

/** parser/state/schedulerをcomposition rootと同じ順序で結線した実機なしのテストハーネス */
function setupHarness(rxBufferSize = 127) {
  const transport = new MockTransport()
  const state = new GrblState()
  const scheduler = new GrblScheduler(transport, { rxBufferSize })
  const jobRunner = new JobRunner(scheduler, state)
  const parser = new GrblParser()

  transport.onData((chunk) => {
    for (const event of parser.feed(chunk)) {
      state.applyGrblEvent(event)
      if (event.type === 'ok') scheduler.onAck({ ok: true })
      else if (event.type === 'error') scheduler.onAck({ ok: false, code: event.code })
    }
  })

  return { transport, state, scheduler, jobRunner }
}

async function flushMicrotasks(times = 10): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve()
}

async function flushUntilDone(jobRunner: JobRunner, maxTicks = 50): Promise<void> {
  for (let i = 0; i < maxTicks && jobRunner.isRunning(); i++) {
    await Promise.resolve()
  }
}

describe('JobRunner', () => {
  it('sends all lines via the scheduler and reaches completion', async () => {
    const { transport, state, jobRunner } = setupHarness()
    await transport.open()

    jobRunner.start(['G0 X1', 'G0 X2', 'G0 X3'])
    await flushUntilDone(jobRunner)

    expect(transport.writes).toEqual(['G0 X1\n', 'G0 X2\n', 'G0 X3\n'])
    expect(state.getState().job).toEqual({ running: false, paused: false, currentLine: 3, totalLines: 3 })
  })

  it('pause stops new sends (already-sent lines still complete) and resume continues', async () => {
    // 6byteのコマンド("G0 X1\n"等)が1件だけ収まるバッファ幅にして、送信を1行ずつに強制する
    const { transport, jobRunner, scheduler } = setupHarness(8)
    await transport.open()

    jobRunner.start(['G0 X1', 'G0 X2', 'G0 X3'])
    expect(transport.writes).toEqual(['G0 X1\n']) // 2,3行目はバッファ不足でscheduler内に滞留

    jobRunner.pause()
    expect(scheduler.pendingCount).toBe(1) // 送信済み・ok待ち中の1行目のみ残る

    await flushMicrotasks() // 1行目のokが届くが、pause中なので新規送信はされない
    expect(transport.writes).toEqual(['G0 X1\n'])

    jobRunner.resume()
    await flushUntilDone(jobRunner)

    expect(transport.writes).toEqual(['G0 X1\n', 'G0 X2\n', 'G0 X3\n'])
  })

  it('cancel stops the job and resets progress, ignoring late acks', async () => {
    const { transport, state, jobRunner, scheduler } = setupHarness(8)
    await transport.open()

    jobRunner.start(['G0 X1', 'G0 X2', 'G0 X3'])
    jobRunner.cancel()

    expect(scheduler.pendingCount).toBe(1) // 送信済みの1行目はscheduler内に残るが、jobとしては終了済み
    expect(jobRunner.isRunning()).toBe(false)
    expect(state.getState().job).toEqual({ running: false, paused: false, currentLine: 0, totalLines: 0 })

    await flushMicrotasks()
    expect(state.getState().job.currentLine).toBe(0) // cancel後のokは進捗に反映されない
  })

  it('stops on error without sending the remaining lines', async () => {
    const { transport, state, jobRunner } = setupHarness(8)
    await transport.open()
    transport.queueResponse('ok\r\n') // line1
    transport.queueResponse('error:5\r\n') // line2

    jobRunner.start(['G0 X1', 'G0 X2', 'G0 X3'])
    await flushUntilDone(jobRunner)

    expect(transport.writes).toEqual(['G0 X1\n', 'G0 X2\n'])
    const job = state.getState().job
    expect(job.running).toBe(false)
    expect(job.currentLine).toBe(2)
    expect(job.totalLines).toBe(3)
  })
})
