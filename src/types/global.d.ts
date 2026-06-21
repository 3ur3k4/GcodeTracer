import type { GcodeTracerApi } from '../../electron/preload'

declare global {
  interface Window {
    api: GcodeTracerApi
  }
}

export {}
