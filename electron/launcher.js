const { app } = require('electron')
const path = require('path')
const fs = require('fs')

const config = require('./config')

function getGameDir() {
  return path.join(app.getPath('userData'), 'minecraft')
}

function send(win, channel, data) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, data)
}

function findJava() {
  const candidates = [
    process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', 'javaw.exe') : null,
    'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.4.7-hotspot\\bin\\javaw.exe',
    'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.12.7-hotspot\\bin\\javaw.exe',
    'C:\\Program Files\\Java\\jdk-21\\bin\\javaw.exe',
    'C:\\Program Files\\Java\\jdk-17\\bin\\javaw.exe',
    'C:\\Program Files\\Microsoft\\jdk-21.0.4.7-hotspot\\bin\\javaw.exe',
    'javaw.exe'
  ].filter(Boolean)

  for (const c of candidates) {
    if (c === 'javaw.exe' || fs.existsSync(c)) return c
  }
  return 'javaw.exe'
}

// Wraps a Task from @xmcl/installer to report progress via IPC
function runTask(task, win, text) {
  return new Promise((resolve, reject) => {
    let total = 0
    let current = 0

    task.on('update', (delta) => {
      current += delta
      send(win, 'progress', { type: 'install', current, total, text })
    })

    task.on('total', (t) => {
      total = t
    })

    task.startAndWait().then(resolve).catch(reject)
  })
}

async function launch(opts, mainWindow) {
  const cfg = config.getConfig()
  const gameDir = getGameDir()

  if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true })

  const forgeVersion = cfg.forge_version || '1.20.1-47.4.10'
  const parts = forgeVersion.split('-')
  const mcVersion = parts[0]
  const forgeNum = parts[1]
  const versionId = `${mcVersion}-forge-${forgeNum}`

  const maxRam = opts.ram || cfg.ram?.default_mb || 4096
  const minRam = Math.max(512, Math.floor(maxRam / 4))
  const javaPath = findJava()

  const log = (msg) => send(mainWindow, 'log', String(msg).trim())
  const progress = (data) => send(mainWindow, 'progress', data)

  log(`[Launcher] Java: ${javaPath}`)
  log(`[Launcher] Versão: ${versionId} | RAM: ${minRam}–${maxRam}MB`)

  try {
    const { launch: xmclLaunch, Version } = require('@xmcl/core')
    const {
      getVersionList,
      installVersion,
      installForge,
      installDependencies
    } = require('@xmcl/installer')

    const versionJson = path.join(gameDir, 'versions', versionId, `${versionId}.json`)

    if (!fs.existsSync(versionJson)) {
      // 1. Instalar Minecraft base
      log(`[Launcher] Baixando Minecraft ${mcVersion}...`)
      const list = await getVersionList()
      const mcMeta = list.versions.find(v => v.id === mcVersion)
      if (!mcMeta) throw new Error(`Versão ${mcVersion} não encontrada`)

      await installVersion(mcMeta, gameDir)
      log(`[Launcher] Minecraft ${mcVersion} instalado.`)

      // 2. Instalar Forge
      log(`[Launcher] Instalando Forge ${forgeNum}...`)
      progress({ type: 'forge', current: 0, total: 1, text: `Instalando Forge ${forgeNum}...` })

      await installForge(
        { mcversion: mcVersion, version: forgeNum },
        gameDir,
        { java: javaPath }
      )
      log(`[Launcher] Forge instalado.`)

      // 3. Instalar dependências (assets + libs)
      log(`[Launcher] Baixando bibliotecas e assets...`)
      const resolvedVersion = await Version.parse(gameDir, versionId)
      await installDependencies(resolvedVersion, {
        onProgress: ({ task, total }) => {
          progress({ type: 'assets', current: task, total, text: 'Baixando assets e bibliotecas...' })
        }
      })
      log(`[Launcher] Dependências instaladas.`)
    }

    log('[Launcher] Iniciando jogo...')
    progress(null)

    const proc = await xmclLaunch({
      gamePath: gameDir,
      javaPath,
      version: versionId,
      minMemory: minRam,
      maxMemory: maxRam,
      accessToken: opts.accessToken || '0',
      username: opts.username,
      uuid: opts.uuid,
      userType: opts.accountType === 'microsoft' ? 'msa' : 'legacy',
      extraJVMArgs: ['-XX:+UseG1GC', '-XX:+ParallelRefProcEnabled', '-XX:MaxGCPauseMillis=200']
    })

    proc.stdout?.on('data', (d) => log(d.toString()))
    proc.stderr?.on('data', (d) => log('[WARN] ' + d.toString()))
    proc.on('close', (code) => {
      log(`[Launcher] Jogo encerrado (código ${code})`)
      progress(null)
    })

    return { success: true }
  } catch (err) {
    log(`[Erro] ${err.message}`)
    return { success: false, error: err.message }
  }
}

module.exports = { launch, getGameDir }
