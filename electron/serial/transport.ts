/**
 * シリアルポートのlist/open/close/write/readのみを担う。GRBL構文(ok/error/ステータス報告等)を一切知らない。
 * 上位(grbl/parser.ts等)が生データをどう解釈するかには関与しない。
 */
import { SerialPort } from 'serialport'
import type { PortInfo } from '../../shared/ipcContract'

export interface Transport {
  list(): Promise<PortInfo[]>
  open(path: string, baudRate: number): Promise<void>
  close(): Promise<void>
  write(data: string): void
  isOpen(): boolean
  onData(listener: (chunk: string) => void): void
  onClose(listener: () => void): void
}

export class SerialTransport implements Transport {
  private port: SerialPort | null = null
  private dataListeners: Array<(chunk: string) => void> = []
  private closeListeners: Array<() => void> = []

  async list(): Promise<PortInfo[]> {
    const ports = await SerialPort.list()
    return ports.map((p) => ({ path: p.path, manufacturer: p.manufacturer }))
  }

  open(path: string, baudRate: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const port = new SerialPort({ path, baudRate, autoOpen: false }, (err) => {
        if (err) reject(err)
      })
      port.open((err) => {
        if (err) {
          reject(err)
          return
        }
        port.on('data', (chunk: Buffer) => {
          const text = chunk.toString('utf8')
          for (const listener of this.dataListeners) listener(text)
        })
        port.on('close', () => {
          this.port = null
          for (const listener of this.closeListeners) listener()
        })
        port.on('error', () => {
          // 接続断はcloseイベント側で扱う。ここでは握りつぶしてプロセス全体を落とさない。
        })
        this.port = port
        resolve()
      })
    })
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.port) {
        resolve()
        return
      }
      this.port.close((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  write(data: string): void {
    if (!this.port) throw new Error('Transport is not open')
    this.port.write(data)
  }

  isOpen(): boolean {
    return this.port !== null && this.port.isOpen
  }

  onData(listener: (chunk: string) => void): void {
    this.dataListeners.push(listener)
  }

  onClose(listener: () => void): void {
    this.closeListeners.push(listener)
  }
}
