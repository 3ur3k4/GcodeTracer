import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GrblScheduler } from './scheduler'
import type { Transport } from '../serial/transport'

/** バッファ計算をミリ秒単位の非同期挙動から分離して検証するための最小限の書き込み記録Transport */
class RecordingTransport implements Transport {
  writes: string[] = []
  async list() {
    return []
  }
  async open() {}
  async close() {}
  write(data: string): void {
    this.writes.push(data)
  }
  isOpen(): boolean {
    return true
  }
  onData(): void {}
  onClose(): void {}
}

describe('GrblScheduler character-counting', () => {
  it('sends a queued command immediately when the buffer has room', () => {
    const transport = new RecordingTransport()
    const scheduler = new GrblScheduler(transport, { rxBufferSize: 127 })

    scheduler.enqueue('G0 X0')

    expect(transport.writes).toEqual(['G0 X0\n'])
    expect(scheduler.bufferUsage).toBe('G0 X0\n'.length)
  })

  it('holds back commands that would exceed the RX buffer size', () => {
    const transport = new RecordingTransport()
    const scheduler = new GrblScheduler(transport, { rxBufferSize: 10 })

    scheduler.enqueue('123456') // 7 bytes with \n -> fits exactly (7<=10)
    scheduler.enqueue('1234') // 5 bytes with \n -> 7+5=12 > 10, must wait

    expect(transport.writes).toEqual(['123456\n'])
    expect(scheduler.pendingCount).toBe(2)
  })

  it('releases buffer space on ok and sends the next queued command', () => {
    const transport = new RecordingTransport()
    const scheduler = new GrblScheduler(transport, { rxBufferSize: 10 })

    scheduler.enqueue('123456') // 7 bytes
    scheduler.enqueue('1234') // 5 bytes, blocked until ack

    scheduler.onAck({ ok: true }) // simulate 'ok' for the first command

    expect(transport.writes).toEqual(['123456\n', '1234\n'])
    expect(scheduler.pendingCount).toBe(1) // still awaiting ack for the second
  })

  it('sends realtime commands immediately, bypassing the queue', () => {
    const transport = new RecordingTransport()
    const scheduler = new GrblScheduler(transport, { rxBufferSize: 1 })

    scheduler.enqueue('a very long command that will not fit')
    scheduler.cycleStartResume()
    scheduler.feedHold()

    expect(transport.writes).toEqual(['~', '!'])
    expect(scheduler.pendingCount).toBe(1) // the long command is still queued, unaffected
  })

  it('clears in-flight bookkeeping on soft reset', () => {
    const transport = new RecordingTransport()
    const scheduler = new GrblScheduler(transport, { rxBufferSize: 100 })

    scheduler.enqueue('G0 X0')
    scheduler.softReset()

    expect(transport.writes.at(-1)).toBe('\x18')
    expect(scheduler.pendingCount).toBe(0)
    expect(scheduler.bufferUsage).toBe(0)
  })

  it('invokes onComplete only for the matching command, even when queues interleave', () => {
    const transport = new RecordingTransport()
    const scheduler = new GrblScheduler(transport, { rxBufferSize: 100 })
    const calls: string[] = []

    scheduler.enqueue('console-command') // no onComplete (e.g. console-originated)
    scheduler.enqueue('job-line-1', () => calls.push('job-line-1'))
    scheduler.enqueue('job-line-2', () => calls.push('job-line-2'))

    scheduler.onAck({ ok: true }) // acks 'console-command'
    expect(calls).toEqual([])

    scheduler.onAck({ ok: true }) // acks 'job-line-1'
    expect(calls).toEqual(['job-line-1'])

    scheduler.onAck({ ok: false, code: 1 }) // acks 'job-line-2' with an error
    expect(calls).toEqual(['job-line-1', 'job-line-2'])
  })

  it('discards only unsent commands on clearQueue', () => {
    const transport = new RecordingTransport()
    const scheduler = new GrblScheduler(transport, { rxBufferSize: 5 })

    scheduler.enqueue('123') // 4 bytes, sent
    scheduler.enqueue('123') // blocked, queued

    const cleared = scheduler.clearQueue()

    expect(cleared).toBe(1)
    expect(scheduler.pendingCount).toBe(1) // the sent-but-unacked one remains
  })
})

describe('GrblScheduler ACK-based status polling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sends a status query immediately on startPolling, then waits for the ack', () => {
    const transport = new RecordingTransport()
    const scheduler = new GrblScheduler(transport, { pollIntervalMs: 100 })

    scheduler.startPolling()
    expect(transport.writes).toEqual(['?'])

    vi.advanceTimersByTime(50)
    expect(transport.writes).toEqual(['?']) // no second query yet, ack not received
  })

  it('schedules the next query pollIntervalMs after the ack is received', () => {
    const transport = new RecordingTransport()
    const scheduler = new GrblScheduler(transport, { pollIntervalMs: 100 })

    scheduler.startPolling()
    scheduler.notifyStatusReceived()

    vi.advanceTimersByTime(99)
    expect(transport.writes).toEqual(['?'])

    vi.advanceTimersByTime(1)
    expect(transport.writes).toEqual(['?', '?'])
  })

  it('retries with a corrected interval if no response ever arrives (no fixed fire-and-forget)', () => {
    const transport = new RecordingTransport()
    const scheduler = new GrblScheduler(transport, { pollIntervalMs: 100 })

    scheduler.startPolling()
    // 応答が来ない場合、2倍の間隔(200ms)でリトライする
    vi.advanceTimersByTime(199)
    expect(transport.writes).toEqual(['?'])

    vi.advanceTimersByTime(1)
    expect(transport.writes).toEqual(['?', '?'])
  })

  it('stops sending after stopPolling', () => {
    const transport = new RecordingTransport()
    const scheduler = new GrblScheduler(transport, { pollIntervalMs: 100 })

    scheduler.startPolling()
    scheduler.stopPolling()
    vi.advanceTimersByTime(1000)

    expect(transport.writes).toEqual(['?'])
  })
})
