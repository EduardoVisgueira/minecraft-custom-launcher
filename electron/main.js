const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')

const config = require('./config')
const auth = require('./auth')
const launcher = require('./launcher')
const updater = require('./updater')

let mainWindow
const isDev = !app.isPackaged

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 650,
    minWidth: 950,
    minHeight: 600,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  ipcMain.handle('get-config', () => config.getConfig())
  ipcMain.handle('save-settings', (_, settings) => config.saveSettings(settings))

  ipcMain.handle('auth-microsoft', () => auth.loginMicrosoft(mainWindow))
  ipcMain.handle('auth-offline', (_, username) => auth.loginOffline(username))
  ipcMain.handle('get-accounts', () => auth.getAccounts())
  ipcMain.handle('set-active-account', (_, uuid) => auth.setActiveAccount(uuid))
  ipcMain.handle('remove-account', (_, uuid) => auth.removeAccount(uuid))

  ipcMain.handle('launch-game', (_, opts) => launcher.launch(opts, mainWindow))
  ipcMain.handle('check-updates', () => updater.checkAndUpdate(mainWindow))

  ipcMain.handle('open-external', (_, url) => shell.openExternal(url))
  ipcMain.handle('window-minimize', () => mainWindow.minimize())
  ipcMain.handle('window-maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.handle('window-close', () => mainWindow.close())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
