/**
 * Character-Counting方式のコマンドキュー + リアルタイムコマンドの優先送信を担う。
 * シリアルポートへの書き込みは必ずこのモジュールを経由すること(Jog/コンソール/ジョブ実行の例外なし)。
 *
 * - 通常コマンド: GRBLのRXバッファ(既定127byte)を超えないようキューイングし、ok/error受信で
 *   先頭から解放する(FIFO、GRBLは受信順に処理するため)。
 * - リアルタイムコマンド(?, ~, !, 0x18): キューを一切経由せず即座に送信する。
 * - ステータスポーリングはACKベース(前回の'?'応答を受け取った後に次を送る)。応答が来ない場合に
 *   備えて間隔を補正したリトライを行い、固定setIntervalのfire-and-forgetにはしない。
 */
import type { Transport } from '../serial/transport'

export const REALTIME_STATUS_QUERY = '?'
export const REALTIME_CYCLE_START_RESUME = '~'
export const REALTIME_FEED_HOLD = '!'
export const REALTIME_SOFT_RESET = '\x18'

export interface SchedulerOptions {
  /** GRBL既定のRXバッファサイズ(byte)。テスト時は小さい値を注入できる */
  rxBufferSize?: number
  /** ステータスポーリングの基本間隔(ms) */
  pollIntervalMs?: number
}

export type AckResult = { ok: true } | { ok: false; code: number }

interface QueuedCommand {
  command: string
  byteLength: number
  onComplete?: (result: AckResult) => void
  onSend?: () => void
}

export class GrblScheduler {
  private readonly transport: Transport
  private readonly rxBufferSize: number
  private pollIntervalMs: number

  private queue: QueuedCommand[] = []
  private inFlight: QueuedCommand[] = []
  private bufferUsed = 0

  private pollTimer: ReturnType<typeof setTimeout> | null = null
  private pollEnabled = false

  constructor(transport: Transport, options: SchedulerOptions = {}) {
    this.transport = transport
    this.rxBufferSize = options.rxBufferSize ?? 127
    this.pollIntervalMs = options.pollIntervalMs ?? 250
  }

  /**
   * 通常コマンド(改行なしでよい)をキューに積む。
   * onCompleteは「このコマンド自身」のok/error受信時にのみ呼ばれる(FIFO順で対応付けるため、
   * コンソール送信とジョブ送信が同じキューを共有しても互いの進捗を誤って進めない)。
   */
  enqueue(line: string, onComplete?: (result: AckResult) => void, onSend?: () => void): void {
    const command = line.endsWith('\n') ? line : `${line}\n`
    this.queue.push({ command, byteLength: command.length, onComplete, onSend })
    this.pump()
  }

  /** 未送信分をキューから破棄する(jobRunnerのcancel用)。送信済みでok待ち中のものは残る */
  clearQueue(): number {
    const cleared = this.queue.length
    this.queue = []
    return cleared
  }

  get pendingCount(): number {
    return this.queue.length + this.inFlight.length
  }

  get bufferUsage(): number {
    return this.bufferUsed
  }

  /** 'ok'または'error:N'を受信したら呼ぶ。先頭の未確定コマンドを解放し、次を送信する */
  onAck(result: AckResult): void {
    const done = this.inFlight.shift()
    if (done) {
      this.bufferUsed -= done.byteLength
      done.onComplete?.(result)
    }
    this.pump()
  }

  private pump(): void {
    while (this.queue.length > 0 && this.bufferUsed + this.queue[0].byteLength <= this.rxBufferSize) {
      const next = this.queue.shift()
      if (!next) break
      this.bufferUsed += next.byteLength
      this.inFlight.push(next)
      this.transport.write(next.command)
      next.onSend?.()
    }
  }

  cycleStartResume(): void {
    this.transport.write(REALTIME_CYCLE_START_RESUME)
  }

  feedHold(): void {
    this.transport.write(REALTIME_FEED_HOLD)
  }

  /** ソフトリセット送信。GRBL側のRXバッファも破棄されるため、こちら側のキュー状態もリセットする */
  softReset(): void {
    this.queue = []
    this.inFlight = []
    this.bufferUsed = 0
    this.transport.write(REALTIME_SOFT_RESET)
  }

  // --- ACKベースのステータスポーリング ---

  startPolling(): void {
    if (this.pollEnabled) return
    this.pollEnabled = true
    this.sendPollNow()
  }

  stopPolling(): void {
    this.pollEnabled = false
    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }
  }

  setPollInterval(ms: number): void {
    this.pollIntervalMs = ms
  }

  /** ステータス報告('<...>')を受信したら呼ぶ。受信を確認してから次回分をスケジュールする */
  notifyStatusReceived(): void {
    if (!this.pollEnabled) return
    if (this.pollTimer) clearTimeout(this.pollTimer)
    this.pollTimer = setTimeout(() => this.sendPollNow(), this.pollIntervalMs)
  }

  private sendPollNow(): void {
    if (!this.pollEnabled) return
    this.transport.write(REALTIME_STATUS_QUERY)
    // 応答が来ないまま取りこぼした場合に備え、間隔を2倍に補正してリトライする
    if (this.pollTimer) clearTimeout(this.pollTimer)
    this.pollTimer = setTimeout(() => this.sendPollNow(), this.pollIntervalMs * 2)
  }
}
