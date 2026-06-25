/**
 * Gコードファイルの行送り・一時停止/再開/キャンセル・進捗追跡を担う。
 * 送信は必ずgrbl/scheduler.ts経由(enqueue)で行い、シリアルポートへ直接書き込まない。
 *
 * 進捗(currentLine)は「ok/errorが返り完了した行数」であり、「送信した行数」ではない
 * (送信済みでも応答待ちの行はまだ完了とみなさない)。
 */
import type { GrblScheduler, AckResult } from '../grbl/scheduler'
import type { GrblState } from '../grbl/state'

export class JobRunner {
  private readonly scheduler: GrblScheduler
  private readonly state: GrblState

  private lines: string[] = []
  private sentCount = 0
  private completedCount = 0
  private running = false
  private paused = false

  constructor(scheduler: GrblScheduler, state: GrblState) {
    this.scheduler = scheduler
    this.state = state
  }

  isRunning(): boolean {
    return this.running
  }

  start(lines: string[], startLine = 0): void {
    this.lines = lines
    this.sentCount = startLine
    this.completedCount = startLine
    this.running = true
    this.paused = false
    this.state.setJobProgress({ running: true, paused: false, currentLine: startLine, totalLines: lines.length })
    this.pump()
  }

  pause(): void {
    if (!this.running || this.paused) return
    this.paused = true
    // scheduler内でまだ送信されていない行をキューから引き戻す(送信済み・ok待ち中の行は継続させる)
    const cleared = this.scheduler.clearQueue()
    this.sentCount -= cleared
    this.state.setJobProgress({ paused: true })
  }

  resume(): void {
    if (!this.running || !this.paused) return
    this.paused = false
    this.state.setJobProgress({ paused: false })
    this.pump()
  }

  cancel(): void {
    if (!this.running) return
    this.scheduler.clearQueue()
    this.running = false
    this.paused = false
    this.lines = []
    this.sentCount = 0
    this.completedCount = 0
    this.state.setJobProgress({ running: false, paused: false, currentLine: 0, totalLines: 0 })
  }

  private pump(): void {
    if (!this.running || this.paused) return
    while (this.sentCount < this.lines.length) {
      const line = this.lines[this.sentCount]
      this.sentCount += 1
      this.state.appendConsoleLine('tx', line)
      this.scheduler.enqueue(line, (result) => this.onLineComplete(result))
    }
  }

  private onLineComplete(result: AckResult): void {
    if (!this.running) return
    this.completedCount += 1
    this.state.setJobProgress({ currentLine: this.completedCount })

    if (!result.ok) {
      // エラー発生時はジョブを停止する。scheduler内で未送信のまま残っている行(同期的にenqueue済みだが
      // バッファ待ちのもの)も、ここで明示的に破棄しないと送信され続けてしまうため必ずclearQueueする。
      this.scheduler.clearQueue()
      this.running = false
      this.state.setJobProgress({ running: false, paused: false })
      return
    }

    if (this.completedCount >= this.lines.length) {
      this.running = false
      this.state.setJobProgress({ running: false, paused: false })
      return
    }
  }
}
