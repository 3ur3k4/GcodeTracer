import path from 'node:path'
import { app, BrowserWindow, nativeImage } from 'electron'
import { IPC_CHANNELS } from '../shared/ipcContract'
import { createApp, type App } from './app'
import { SerialTransport } from './serial/transport'

const APP_ROOT = path.join(__dirname, '..')
const MAIN_DIST = path.join(APP_ROOT, 'dist-electron')
const RENDERER_DIST = path.join(APP_ROOT, 'dist')
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

let win: BrowserWindow | null = null
let runningApp: App | null = null

function createWindow(): void {
  const iconPath = path.join(APP_ROOT, 'build', 'icon.icns')
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Gcode Tracer',
    icon: iconPath,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 15 },
    webPreferences: {
      preload: path.join(MAIN_DIST, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  runningApp = createApp({ win, createTransport: () => new SerialTransport() })

  win.on('enter-full-screen', () => win?.webContents.send(IPC_CHANNELS.fullscreenChanged, true))
  win.on('leave-full-screen', () => win?.webContents.send(IPC_CHANNELS.fullscreenChanged, false))
  win.on('closed', () => {
    win = null
  })
}

app.on('window-all-closed', () => {
  void runningApp?.dispose()
  runningApp = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.whenReady().then(() => {
  const icon = nativeImage.createFromPath(path.join(APP_ROOT, 'build', 'icon.icns'))
  if (!icon.isEmpty()) app.dock?.setIcon(icon)
  createWindow()
})
