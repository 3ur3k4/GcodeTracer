/**
 * `osc` パッケージは型定義を同梱しておらず@types/oscも存在しないため、
 * 本プロジェクトで使用する範囲のみの最小限のアンビエント宣言を置く。
 */
declare module 'osc' {
  import { EventEmitter } from 'node:events'

  export interface OscArgument {
    type: string
    value: number | string
  }

  export interface OscMessage {
    address: string
    args: OscArgument[]
  }

  export interface UDPPortOptions {
    localAddress?: string
    localPort?: number
    remoteAddress?: string
    remotePort?: number
    metadata?: boolean
  }

  export class UDPPort extends EventEmitter {
    constructor(options: UDPPortOptions)
    open(): void
    close(): void
    send(message: OscMessage, address?: string, port?: number): void
  }
}
