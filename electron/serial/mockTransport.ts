/**
 * テスト用Transportスタブ。実GRBLデバイスの代わりに、文字列ベースで
 * ok / error:N / ステータス報告を返す。scheduler.ts/jobRunner.tsを実機なしで検証するために使う。
 *
 * デフォルト挙動: 通常コマンド(改行終端)には'ok'、'?'には簡易ステータス報告、
 * 0x18(ソフトリセット)にはwelcomeバナーを返す。`queueResponse`で個別の応答を差し込める。
 */
import type { Transport } from './transport'
import type { PortInfo } from '../../shared/ipcContract'

const DEFAULT_STATUS = '<Idle|MPos:0.000,0.000,0.000|FS:0,0>\r\n'
const WELCOME = "Grbl 1.1h ['$' for help]\r\n"

export class MockTransport implements Transport {
  private open_ = false
  private dataListeners: Array<(chunk: string) => void> = []
  private closeListeners: Array<() => void> = []
  private queuedResponses: string[] = []
  /** writeされた生データの履歴(テストでのアサーション用) */
  readonly writes: string[] = []

  async list(): Promise<PortInfo[]> {
    return [{ path: '/dev/mock-grbl', manufacturer: 'Mock' }]
  }

  async open(): Promise<void> {
    this.open_ = true
  }

  async close(): Promise<void> {
    this.open_ = false
    for (const listener of this.closeListeners) listener()
  }

  isOpen(): boolean {
    return this.open_
  }

  write(data: string): void {
    if (!this.open_) throw new Error('MockTransport is not open')
    this.writes.push(data)
    queueMicrotask(() => this.respondTo(data))
  }

  onData(listener: (chunk: string) => void): void {
    this.dataListeners.push(listener)
  }

  onClose(listener: () => void): void {
    this.closeListeners.push(listener)
  }

  /** 次に届く応答を1件先頭に積む(例: 'error:2\r\n')。通常コマンド1件につき1回消費される。 */
  queueResponse(response: string): void {
    this.queuedResponses.push(response)
  }

  /** 書き込みと無関係な非同期データ(アラーム・feedback等)をシミュレートする */
  emit(chunk: string): void {
    for (const listener of this.dataListeners) listener(chunk)
  }

  private respondTo(data: string): void {
    if (data === '?') {
      this.emit(DEFAULT_STATUS)
      return
    }
    if (data === '~' || data === '!') {
      return
    }
    if (data === '\x18') {
      this.emit(WELCOME)
      return
    }
    const queued = this.queuedResponses.shift()
    this.emit(queued ?? 'ok\r\n')
  }
}
