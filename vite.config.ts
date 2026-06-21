import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron/simple'

export default defineConfig({
  plugins: [
    vue(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            // serialportはネイティブアドオン(.node)を動的に解決するため、バンドルせずnode_modulesから
            // そのままrequireさせる(バンドルするとプリビルド探索ロジックが壊れ、ABI不一致エラーになる)。
            // Vite 8はRolldownを既定バンドラとして使うため、rollupOptionsではなくrolldownOptionsで指定する。
            rolldownOptions: { external: ['serialport', '@serialport/bindings-cpp'] },
          },
        },
      },
      preload: {
        input: fileURLToPath(new URL('electron/preload.ts', import.meta.url)),
        vite: {
          build: { outDir: 'dist-electron' },
        },
      },
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['electron/**/*.test.ts'],
  },
})
