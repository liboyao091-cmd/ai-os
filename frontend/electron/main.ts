import { app, BrowserWindow, shell } from 'electron'
import path from 'path'
import { spawn, ChildProcess } from 'child_process'

let mainWindow: BrowserWindow | null = null
let backendProcess: ChildProcess | null = null

const isDev = process.env.NODE_ENV !== 'production'
const PORT = 8000

function startBackend() {
  const backendDir = path.join(__dirname, '..', '..', 'backend')
  const pythonExe = process.platform === 'win32' ? 'python' : 'python3'

  backendProcess = spawn(pythonExe, ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', String(PORT)], {
    cwd: path.join(__dirname, '..', '..'),
    env: { ...process.env, PYTHONPATH: path.join(__dirname, '..', '..') },
    stdio: 'pipe',
  })

  backendProcess.stdout?.on('data', (d: Buffer) => console.log('[backend]', d.toString().trim()))
  backendProcess.stderr?.on('data', (d: Buffer) => console.error('[backend]', d.toString().trim()))
  backendProcess.on('exit', code => console.log('[backend] exited with code', code))
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'DS AI OS',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  const url = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../dist/index.html')}`

  mainWindow.loadURL(url)

  if (isDev) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  if (!isDev) {
    startBackend()
    // Give backend a moment to start
    setTimeout(createWindow, 2000)
  } else {
    createWindow()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill()
    backendProcess = null
  }
  if (process.platform !== 'darwin') app.quit()
})
