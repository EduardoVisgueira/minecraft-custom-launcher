import { app, BrowserWindow, ipcMain, shell, protocol, net } from 'electron'
import path from 'path'
import os from 'os'
import { fileURLToPath, pathToFileURL } from 'url'
import { getConfig, saveSettings, refreshRemoteConfig } from './config.js'
import { loginMicrosoft, loginOffline, getAccounts, setActiveAccount, removeAccount, ensureValidToken } from './auth.js'
import { launch, getForgeVersions, getInstalledForge, killGame } from './launcher.js'
import { checkAndUpdate } from './updater.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
let mainWindow

// Diretório base das imagens locais (slideshow/logo). Em produção vêm de
// extraResources (resources/assets); em dev, da raiz do projeto.
function getAssetsBase() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets')
}

// Registra o protocolo "asset://" para servir imagens locais sem precisar de
// webSecurity:false. Substitui o acesso file:// arbitrário do renderer.
function registerAssetProtocol() {
  protocol.handle('asset', (request) => {
    const base = getAssetsBase()
    // asset://local/<caminho-relativo-dentro-de-assets>
    let rel = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '')
    const target = path.resolve(base, rel)
    // Anti path-traversal: nunca sair de getAssetsBase()
    const relCheck = path.relative(base, target)
    if (relCheck.startsWith('..') || path.isAbsolute(relCheck)) {
      return new Response('Forbidden', { status: 403 })
    }
    return net.fetch(pathToFileURL(target).toString())
  })
}

// Converte caminhos relativos de imagens do config (ex.: "assets/slideshow/x.svg")
// em URLs asset:// que o renderer pode carregar com segurança.
function toAssetUrl(p) {
  if (typeof p !== 'string' || !p) return p
  if (/^(asset|https?|data):/i.test(p)) return p
  const rel = p.replace(/^\.?[\\/]/, '').replace(/^assets[\\/]/i, '').replace(/\\/g, '/')
  return `asset://local/${rel}`
}

// Reescreve os campos de imagem do config para URLs asset:// (não muda nomes de campos).
function rewriteAssetPaths(cfg) {
  if (!cfg || typeof cfg !== 'object') return cfg
  const out = { ...cfg }
  if (Array.isArray(out.slideshow_images)) {
    out.slideshow_images = out.slideshow_images.map(toAssetUrl)
  }
  // Logo do tema: URL https remota passa direto; caminho local vira asset://
  if (out.theme && typeof out.theme === 'object' && out.theme.logo_url) {
    out.theme = { ...out.theme, logo_url: toAssetUrl(out.theme.logo_url) }
  }
  return out
}

function createWindow() {
  const preloadPath = path.join(__dirname, '../preload/preload.js')

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 650,
    minWidth: 950,
    minHeight: 600,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
      // sandbox: true -> NÃO habilitado: o preload é bundlado pelo electron-vite
      // e habilitar sandbox pode quebrar o contextBridge/IPC. contextIsolation +
      // nodeIntegration:false já garantem o isolamento principal.
    }
  })

  // Bloqueia abertura de novas janelas; links externos vão para o navegador padrão.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const { protocol: proto } = new URL(url)
      if (proto === 'http:' || proto === 'https:') shell.openExternal(url)
    } catch {}
    return { action: 'deny' }
  })

  // Bloqueia navegação fora da origem do app (anti phishing/redirect).
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = app.isPackaged ? 'file://' : 'http://localhost:5173'
    if (!url.startsWith(allowed)) event.preventDefault()
  })

  // DevTools (F12 / Ctrl+Shift+I): SÓ em desenvolvimento. No .exe empacotado
  // (app.isPackaged) fica desativado automaticamente — sem risco de o jogador abrir.
  if (!app.isPackaged) {
    mainWindow.webContents.on('before-input-event', (_e, input) => {
      if (input.type !== 'keyDown') return
      const toggleCombo = (input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i'
      if (input.key === 'F12' || toggleCombo) mainWindow.webContents.toggleDevTools()
    })
  }

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }
}

// Esquema privilegiado deve ser registrado antes do app ficar pronto.
protocol.registerSchemesAsPrivileged([
  { scheme: 'asset', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
])

app.whenReady().then(async () => {
  registerAssetProtocol()

  // Busca o config remoto ANTES de abrir a janela (offline-first: timeout interno
  // de ~8s no fetch; se falhar, segue com cache/bootstrap sem travar).
  try { await refreshRemoteConfig() } catch {}

  createWindow()

  ipcMain.handle('get-config', () => rewriteAssetPaths(getConfig()))
  // Re-baixa o config remoto e devolve o config já mesclado (para botão Atualizar).
  ipcMain.handle('refresh-config', async () => {
    await refreshRemoteConfig()
    return rewriteAssetPaths(getConfig())
  })
  ipcMain.handle('save-settings', (_, settings) => saveSettings(settings))

  ipcMain.handle('auth-microsoft', () => loginMicrosoft(mainWindow))
  ipcMain.handle('auth-offline', (_, username) => loginOffline(username))
  ipcMain.handle('get-accounts', () => getAccounts())
  ipcMain.handle('set-active-account', (_, uuid) => setActiveAccount(uuid))
  ipcMain.handle('remove-account', (_, uuid) => removeAccount(uuid))

  ipcMain.handle('launch-game', async (_, opts) => {
    // Renova o token Microsoft (se expirado) antes de lançar
    if (opts?.accountType === 'microsoft' && opts.uuid) {
      const res = await ensureValidToken(opts.uuid)
      if (!res.success) {
        mainWindow.webContents.send('log', `[Erro] Sessão Microsoft: ${res.error}`)
        return { success: false, error: res.error }
      }
      opts = { ...opts, accessToken: res.account.accessToken, username: res.account.username, uuid: res.account.uuid }
    }
    return launch(opts, mainWindow)
  })
  ipcMain.handle('check-updates', () => checkAndUpdate(mainWindow))

  // RAM física da máquina (MB) — usado para limitar o slider de alocação
  ipcMain.handle('get-system-ram', () => Math.floor(os.totalmem() / (1024 * 1024)))

  // Lista de versões do Forge (para o seletor com busca na UI)
  ipcMain.handle('get-forge-versions', () => getForgeVersions())
  ipcMain.handle('get-installed-forge', () => getInstalledForge())
  ipcMain.handle('kill-game', () => killGame())

  ipcMain.handle('open-external', (_, url) => {
    // Só abre links http/https/mailto — bloqueia file://, cmd://, etc.
    try {
      const { protocol } = new URL(String(url))
      if (['http:', 'https:', 'mailto:'].includes(protocol)) {
        return shell.openExternal(url)
      }
    } catch {}
    return Promise.resolve()
  })
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
