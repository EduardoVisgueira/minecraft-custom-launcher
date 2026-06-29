import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import https from 'https'
import { getConfig } from './config.js'

const JAVA_RUNTIME_ALL_URL = 'https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json'

export function getGameDir() {
  return path.join(app.getPath('userData'), 'minecraft')
}

// Slug seguro pra nome de instância (ex.: "Zona Morta" -> "zona-morta")
export function slugify(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()
}
// Id da instância do modpack, derivado do nome no config
export function getModpackInstanceId(cfg) {
  return slugify(cfg?.modpack?.name) || 'modpack'
}
// Pasta ISOLADA da instância (mods/config/saves próprios). assets/libraries/
// versions ficam na raiz (getGameDir), compartilhados entre todas as instâncias.
export function getInstanceDir(instanceId) {
  return path.join(getGameDir(), 'instances', slugify(instanceId) || 'default')
}

// Versões de Forge já instaladas localmente (com marker .install-ok), no formato
// maven "<mc>-<forge>" — para destacar no topo do seletor.
export function getInstalledForge() {
  try {
    const versionsDir = path.join(getGameDir(), 'versions')
    if (!fs.existsSync(versionsDir)) return []
    const out = []
    for (const dir of fs.readdirSync(versionsDir)) {
      const m = dir.match(/^(.+)-forge-(.+)$/)
      if (m && fs.existsSync(path.join(versionsDir, dir, '.install-ok'))) {
        out.push(`${m[1]}-${m[2]}`)
      }
    }
    return out
  } catch { return [] }
}

// Lista TODAS as versões de Forge já lançadas (maven oficial), no formato
// "<mc>-<forge>" ex.: "1.20.1-47.4.10". Usada pelo seletor de versões na UI.
export function getForgeVersions() {
  return new Promise((resolve) => {
    https.get({
      hostname: 'maven.minecraftforge.net',
      path: '/net/minecraftforge/forge/maven-metadata.xml',
      family: 4, headers: { 'User-Agent': 'mc-launcher' }
    }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve({ success: false, error: `HTTP ${res.statusCode}`, versions: [] }) }
      let data = ''
      res.on('data', (c) => { data += c })
      res.on('end', () => {
        const versions = [...data.matchAll(/<version>(.*?)<\/version>/g)].map(m => m[1])
        // mais recentes primeiro
        resolve({ success: true, versions: versions.reverse() })
      })
    }).on('error', (e) => resolve({ success: false, error: e.message, versions: [] }))
  })
}

// GET JSON via https nativo (IPv4, segue redirects). Usado para buscar o
// manifest do Java oficial sem passar pelo fetch do @xmcl, que é incompatível
// com undici 7 (rejeita throwOnError).
function fetchJSON(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    https.get({
      hostname: u.hostname, path: u.pathname + u.search, family: 4,
      headers: { 'User-Agent': 'mc-launcher' }
    }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 5) {
        res.resume(); return resolve(fetchJSON(res.headers.location, redirects + 1))
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode} em ${url}`)) }
      let data = ''
      res.on('data', (c) => { data += c })
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch (e) { reject(e) } })
    }).on('error', reject)
  })
}

function send(win, channel, data) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, data)
}

// Repete uma etapa de rede em caso de falha. Como o instalador do @xmcl é
// idempotente (só rebaixa o que faltou), repetir converge e resolve o
// AggregateError transitório do download paralelo de assets/bibliotecas.
async function withRetry(fn, label, log, attempts = 4) {
  let lastErr
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (i < attempts) {
        log(`[Launcher] ${label}: falha de rede (tentativa ${i}/${attempts}), repetindo...`)
        await new Promise((r) => setTimeout(r, 1500 * i))
      }
    }
  }
  throw lastErr
}

// Extrai a major version de um nome de diretório de JDK/JRE.
// Ex.: "jdk-17.0.17.10-hotspot" -> 17 | "jdk1.8.0_202" -> 8 | "jdk-21..." -> 21
function parseMajor(name) {
  const m = name.match(/(?:jdk|jre|zulu|temurin|corretto)?-?(\d+)(?:\.(\d+))?/i)
  if (!m) return null
  let major = parseInt(m[1], 10)
  if (major === 1 && m[2]) major = parseInt(m[2], 10) // "1.8" -> 8
  return major
}

// Java mínimo exigido pela versão do Minecraft.
function requiredJava(mcVersion) {
  const parts = mcVersion.split('.').map(Number)
  const minor = parts[1] || 0
  const patch = parts[2] || 0
  if (minor >= 21) return 21
  if (minor === 20 && patch >= 5) return 21
  if (minor >= 18) return 17
  if (minor === 17) return 16
  return 8
}

// Componente de runtime Java oficial da Mojang correspondente ao Java necessário.
function runtimeTarget(need) {
  if (need >= 21) return 'java-runtime-delta'   // Java 21
  if (need >= 17) return 'java-runtime-gamma'   // Java 17
  if (need >= 16) return 'java-runtime-alpha'   // Java 16
  return 'jre-legacy'                            // Java 8
}

// javaw.exe esperado dentro de um runtime Mojang baixado (estrutura Windows).
function mojangJavaw(runtimeDir) {
  return [
    path.join(runtimeDir, 'bin', 'javaw.exe'),
    path.join(runtimeDir, 'jre.bundle', 'Contents', 'Home', 'bin', 'javaw.exe')
  ].find(p => fs.existsSync(p)) || null
}

// Descobre dinamicamente os JDKs/JREs instalados e escolhe o adequado à versão do MC.
function findLocalJava(need) {
  const roots = [
    'C:\\Program Files\\Eclipse Adoptium',
    'C:\\Program Files\\Java',
    'C:\\Program Files\\Microsoft',
    'C:\\Program Files\\Zulu',
    'C:\\Program Files\\BellSoft',
    'C:\\Program Files\\Amazon Corretto',
    'C:\\Program Files\\Eclipse Foundation'
  ]
  const found = []
  for (const root of roots) {
    if (!fs.existsSync(root)) continue
    let dirs = []
    try { dirs = fs.readdirSync(root) } catch { continue }
    for (const dir of dirs) {
      const javaw = path.join(root, dir, 'bin', 'javaw.exe')
      if (fs.existsSync(javaw)) {
        const major = parseMajor(dir)
        if (major) found.push({ major, path: javaw })
      }
    }
  }
  if (process.env.JAVA_HOME) {
    const home = process.env.JAVA_HOME.replace(/[\\/]+$/, '')
    const javaw = path.join(home, 'bin', 'javaw.exe')
    if (fs.existsSync(javaw)) {
      const major = parseMajor(path.basename(home))
      if (major) found.push({ major, path: javaw })
    }
  }

  // Candidatos que atendem ao requisito -> preferir o MENOR major compatível
  const ok = found.filter(j => j.major >= need).sort((a, b) => a.major - b.major)
  if (ok.length) return { path: ok[0].path, version: ok[0].major }
  return null
}

// Garante um Java adequado: usa um local se houver; senão baixa o runtime
// oficial da Mojang (assim o jogador final não precisa instalar Java manualmente).
async function ensureJava(need, mcVersion, gameDir, dispatcher, installer, log, progress) {
  const local = findLocalJava(need)
  if (local) {
    log(`[Launcher] Java ${local.version}: ${local.path}`)
    return local.path
  }

  // A Mojang só distribui runtimes até Java 21. Acima disso (versões muito novas/
  // experimentais), não há download automático — orienta instalação manual.
  if (need > 21) {
    throw new Error(
      `Esta versão precisa do Java ${need}, que ainda não tem download automático. ` +
      `Instale o Java ${need} manualmente em https://adoptium.net/temurin/releases/ e tente de novo. ` +
      `(Dica: para o modpack do servidor, use uma versão 1.20.1 / 1.21 que já funciona automaticamente.)`
    )
  }

  const target = runtimeTarget(need)
  const runtimeDir = path.join(gameDir, 'runtime', target)
  const cached = mojangJavaw(runtimeDir)
  if (cached) {
    log(`[Launcher] Java ${need} (Mojang) já instalado: ${cached}`)
    return cached
  }

  log(`[Launcher] Java ${need} não encontrado no sistema. Baixando Java oficial da Mojang...`)
  progress({ type: 'java', current: 0, total: 1, text: `Baixando Java ${need}...` })

  // Plataforma do runtime conforme a arquitetura do Windows
  const platform = process.arch === 'arm64' ? 'windows-arm64'
    : process.arch === 'ia32' ? 'windows-x86' : 'windows-x64'

  // Busca o manifest manualmente (o fetchJavaRuntimeManifest do @xmcl quebra com undici 7)
  const all = await fetchJSON(JAVA_RUNTIME_ALL_URL)
  const entry = all[platform]?.[target]?.[0]
  if (!entry) throw new Error(`Java ${need} (${target}) indisponível para ${platform}`)
  const raw = await fetchJSON(entry.manifest.url)
  const manifest = { target, files: raw.files, version: entry.version }

  const task = installer.installJavaRuntimeTask({ destination: runtimeDir, manifest, dispatcher })
  await task.startAndWait()
  const javaw = mojangJavaw(runtimeDir)
  if (!javaw) throw new Error('Java baixado, mas javaw.exe não foi encontrado')
  log(`[Launcher] Java ${need} (${entry.version?.name}) instalado.`)
  return javaw
}

// Processo do jogo em execução (só permitimos UMA instância por vez)
let activeProc = null

export function isGameRunning() {
  return !!activeProc
}

export function killGame() {
  if (activeProc) {
    try { activeProc.kill() } catch {}
    activeProc = null
    return { success: true }
  }
  return { success: false }
}

export async function launch(opts, mainWindow) {
  // Bloqueia segunda instância: o renderer decide se encerra a atual
  if (activeProc) return { success: false, alreadyRunning: true }

  const cfg = getConfig()
  const gameDir = getGameDir()
  if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true })

  const forgeVersion = opts.forgeVersion || cfg.forge_version || '1.20.1-47.4.10'
  const parts = forgeVersion.split('-')
  const mcVersion = parts[0]
  const forgeNum = parts[1]
  const versionId = `${mcVersion}-forge-${forgeNum}`
  const maxRam = opts.ram || cfg.ram?.default_mb || 4096
  const minRam = Math.max(512, Math.floor(maxRam / 4))

  // Instância ISOLADA: o --gameDir aponta aqui (mods/config/saves próprios da
  // instância). assets/libraries/versions continuam na raiz (gameDir), via resourcePath.
  const instanceId = opts.instanceId || getModpackInstanceId(cfg)
  const instanceDir = getInstanceDir(instanceId)
  for (const sub of ['mods', 'config', 'saves', 'resourcepacks', 'shaderpacks']) {
    fs.mkdirSync(path.join(instanceDir, sub), { recursive: true })
  }

  const log = (msg) => send(mainWindow, 'log', String(msg).trim())
  const progress = (data) => send(mainWindow, 'progress', data)

  log(`[Launcher] Versão: ${versionId} | RAM: ${minRam}–${maxRam}MB`)

  try {
    const { launch: xmclLaunch, Version } = await import('@xmcl/core')
    const installer = await import('@xmcl/installer')
    const { getVersionList, installVersion, installForge, installDependencies } = installer
    const { Agent, interceptors } = await import('undici')

    // Dispatcher resiliente para os milhares de downloads de assets:
    // - força IPv4 (evita ConnectTimeout em redes com IPv6 problemático)
    // - connect timeout generoso (60s) em vez dos 10s padrão
    // - limita conexões paralelas por host (24) para não saturar a rede
    // - redirect interceptor: o @xmcl lê context.history dos redirects (assets
    //   redirecionam para CDN); sem ele -> TypeError "history in undefined".
    // NÃO usamos retry-via-range (RetryAgent): o resume via header Range colide
    // com a validação do @xmcl e gera "content-range mismatch". O retry fica
    // a cargo do withRetry externo (idempotente).
    const dispatcher = new Agent({
      connections: 24,
      connect: { timeout: 60_000, family: 4 },
      headersTimeout: 60_000,
      bodyTimeout: 120_000
    }).compose(interceptors.redirect({ maxRedirections: 5 }))

    // Remove downloads anteriores corrompidos (0 bytes / .pending) que sabotam o
    // resume e causam ChecksumNotMatchError em loop.
    const cleanCorrupt = (dir) => {
      if (!fs.existsSync(dir)) return
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) cleanCorrupt(p)
        else if (e.name.endsWith('.pending') || fs.statSync(p).size === 0) {
          try { fs.unlinkSync(p) } catch {}
        }
      }
    }
    cleanCorrupt(path.join(gameDir, 'assets', 'objects'))

    const versionDir = path.join(gameDir, 'versions', versionId)
    const versionJson = path.join(versionDir, `${versionId}.json`)
    // Marker gravado só após instalação 100% concluída. Se faltar, reinstala
    // (cobre instalações anteriores corrompidas, ex.: Forge processado com Java errado).
    const marker = path.join(versionDir, '.install-ok')
    const needsInstall = !fs.existsSync(versionJson) || !fs.existsSync(marker)

    // 1. Garante o Minecraft base instalado primeiro — necessário para descobrir
    // o Java correto a partir do JSON da versão.
    const mcJson = path.join(gameDir, 'versions', mcVersion, `${mcVersion}.json`)
    if (!fs.existsSync(mcJson)) {
      log(`[Launcher] Baixando Minecraft ${mcVersion}...`)
      const list = await getVersionList()
      const mcMeta = list.versions.find(v => v.id === mcVersion)
      if (!mcMeta) throw new Error(`Versão ${mcVersion} não encontrada`)
      await withRetry(() => installVersion(mcMeta, gameDir, { dispatcher }), 'Minecraft', log)
      log(`[Launcher] Minecraft ${mcVersion} instalado.`)
    }

    // 2. Java necessário vem do próprio JSON da versão (campo javaVersion). É o
    // método robusto — não depende de adivinhar pela string da versão.
    let javaMajor = requiredJava(mcVersion)
    try {
      const mcResolved = await Version.parse(gameDir, mcVersion)
      if (mcResolved.javaVersion?.majorVersion) javaMajor = mcResolved.javaVersion.majorVersion
    } catch {}
    const javaPath = await ensureJava(javaMajor, mcVersion, gameDir, dispatcher, installer, log, progress)

    if (needsInstall) {
      log(`[Launcher] Instalando Forge ${forgeNum}...`)
      progress({ type: 'forge', current: 0, total: 1, text: `Instalando Forge ${forgeNum}...` })
      await withRetry(
        () => installForge({ mcversion: mcVersion, version: forgeNum }, gameDir, { java: javaPath, dispatcher }),
        'Forge', log
      )
      log(`[Launcher] Forge instalado.`)

      log(`[Launcher] Baixando assets e bibliotecas...`)
      const resolvedVersion = await Version.parse(gameDir, versionId)
      await withRetry(() => installDependencies(resolvedVersion, {
        dispatcher,
        onProgress: ({ task, total }) => {
          progress({ type: 'assets', current: task, total, text: 'Baixando assets...' })
        }
      }), 'Assets', log)
      log(`[Launcher] Dependências instaladas.`)

      // Marca instalação como concluída com sucesso
      fs.writeFileSync(marker, new Date().toISOString())
    }

    log('[Launcher] Iniciando jogo...')
    progress(null)

    const proc = await xmclLaunch({
      gamePath: instanceDir, resourcePath: gameDir, javaPath, version: versionId,
      minMemory: minRam, maxMemory: maxRam,
      // nome+uuid REAIS vão em gameProfile (senão o @xmcl usa "Steve" + uuid aleatório,
      // o que causava o "entra como Steve" e o "Invalid signature for profile public key").
      gameProfile: { name: opts.username, id: opts.uuid },
      accessToken: opts.accessToken || '0',
      userType: opts.accountType === 'microsoft' ? 'msa' : 'legacy',
      extraJVMArgs: ['-XX:+UseG1GC', '-XX:+ParallelRefProcEnabled', '-XX:MaxGCPauseMillis=200'],
      // detached: o jogo roda em processo próprio; fechar o launcher NÃO mata o MC
      extraExecOption: { detached: true }
    })
    proc.unref?.()  // launcher não fica preso ao jogo (pode fechar sem derrubar o MC)

    activeProc = proc
    proc.stdout?.on('data', (d) => log(d.toString()))
    proc.stderr?.on('data', (d) => log('[WARN] ' + d.toString()))
    proc.on('error', (e) => { log(`[Erro] Falha ao iniciar processo Java: ${e.message}`); activeProc = null; send(mainWindow, 'game-closed') })
    proc.on('close', (code) => { log(`[Launcher] Jogo encerrado (código ${code})`); progress(null); activeProc = null; send(mainWindow, 'game-closed') })

    return { success: true }
  } catch (err) {
    // AggregateError (download em massa) tem a causa real em err.errors, não em message
    let detail = err?.message || err?.stack || String(err) || 'erro desconhecido'
    if (Array.isArray(err?.errors) && err.errors.length) {
      const first = err.errors.find(e => e?.message) || err.errors[0]
      detail = `Falha em ${err.errors.length} download(s). Ex.: ${first?.message || first}`
    }
    log(`[Erro] ${detail}`)
    console.error('[launch] erro completo:', err)
    progress(null)
    return { success: false, error: detail }
  }
}
