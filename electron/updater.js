import path from 'path'
import fs from 'fs'
import os from 'os'
import https from 'https'
import crypto from 'crypto'
import AdmZip from 'adm-zip'
import { getConfig, saveSettings } from './config.js'
import { getInstanceDir, getModpackInstanceId } from './launcher.js'

function send(win, channel, data) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, data)
}

// Garante que `target` está contido dentro de `base` (anti path-traversal).
function isInside(base, target) {
  const rel = path.relative(base, target)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

// Rejeita URLs que não sejam https:// (evita MITM no canal de download/manifest).
function assertHttps(url, label) {
  let u
  try { u = new URL(url) } catch { throw new Error(`${label} inválida: ${url}`) }
  if (u.protocol !== 'https:') throw new Error(`${label} deve usar https:// (recebido ${u.protocol}//)`)
  return u
}

// Hash genérico (sha256 do nosso gerador OU sha512/sha1 dos packs do Modrinth)
function hashFile(filePath, algo = 'sha256') {
  return new Promise((resolve) => {
    if (!fs.existsSync(filePath)) return resolve(null)
    const hash = crypto.createHash(algo)
    const stream = fs.createReadStream(filePath)
    stream.on('data', (d) => hash.update(d))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', () => resolve(null))
  })
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(dest)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const file = fs.createWriteStream(dest + '.tmp')
    const request = (targetUrl) => {
      try { assertHttps(targetUrl, 'URL de download') } catch (e) {
        file.close(); fs.unlink(dest + '.tmp', () => {}); return reject(e)
      }
      https.get(targetUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return request(res.headers.location)
        }
        if (res.statusCode !== 200) {
          file.close()
          fs.unlink(dest + '.tmp', () => {})
          return reject(new Error(`HTTP ${res.statusCode}`))
        }
        res.pipe(file)
        file.on('finish', () => file.close(() => fs.rename(dest + '.tmp', dest, resolve)))
      }).on('error', (err) => { file.close(); fs.unlink(dest + '.tmp', () => {}); reject(err) })
    }
    request(url)
  })
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    try { assertHttps(url, 'URL do manifest') } catch (e) { return reject(e) }
    https.get(url, (res) => {
      let data = ''
      res.on('data', (c) => { data += c })
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch (e) { reject(e) } })
    }).on('error', reject)
  })
}

function copyFile(src, dest) {
  const dir = path.dirname(dest)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.copyFileSync(src, dest)
}

// Aplica uma lista de arquivos na instância: cada item tem `path` (destino) e
// `url` (baixa da CDN) OU `localSrc` (copia, p/ overrides do .mrpack). Só mexe no
// que mudou (diff por hash). Hashes: sha256 (nosso) / sha512 / sha1 (Modrinth);
// overrides sem hash no índice usam o hash do próprio arquivo de origem.
async function applyFiles(files, gameDir, log, progress) {
  let downloaded = 0, upToDate = 0
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const dest = path.resolve(gameDir, file.path.replace(/\//g, path.sep))
    if (!isInside(gameDir, dest)) { log(`Ignorado (caminho inseguro): ${file.path}`); continue }
    progress({ type: 'modpack', current: i + 1, total: files.length, text: `Verificando ${path.basename(file.path)}...` })

    let algo = file.sha256 ? 'sha256' : (file.sha512 ? 'sha512' : (file.sha1 ? 'sha1' : 'sha256'))
    let want = file.sha256 || file.sha512 || file.sha1 || null
    if (!want && file.localSrc) want = await hashFile(file.localSrc, 'sha256') // override → hash da origem

    const localHash = await hashFile(dest, algo)
    const needs = want ? (localHash !== want) : !fs.existsSync(dest)
    if (!needs) { upToDate++; continue }

    log(`Atualizando ${path.basename(file.path)}...`)
    if (file.url) await downloadFile(file.url, dest)
    else if (file.localSrc) copyFile(file.localSrc, dest)
    else continue

    // Verifica integridade só de downloads remotos (cópia local já bate por construção)
    if (want && file.url) {
      const newHash = await hashFile(dest, algo)
      if (newHash !== want) { fs.unlinkSync(dest); throw new Error(`Hash divergente em ${file.path} (arquivo rejeitado)`) }
    }
    downloaded++
  }
  return { downloaded, upToDate }
}

// Remove ARQUIVOS nas managedDirs que não estão no set `wanted`. Ignora entradas
// que começam com '.' (ex.: .connector — runtime) e nunca apaga diretório.
function sweepManaged(gameDir, wanted, managedDirs, log) {
  const sweep = (root) => {
    for (const e of fs.readdirSync(root, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue
      const abs = path.join(root, e.name)
      if (e.isDirectory()) { sweep(abs); continue }
      if (!isInside(gameDir, abs)) continue
      const rel = path.relative(gameDir, abs).replace(/\\/g, '/')
      if (!wanted.has(rel)) { try { fs.unlinkSync(abs); log(`Removido: ${rel}`) } catch { /* lock/perm: ignora */ } }
    }
  }
  for (const dir of managedDirs) {
    const full = path.resolve(gameDir, dir)
    if (!isInside(gameDir, full) || !fs.existsSync(full)) continue
    sweep(full)
  }
}

// ── Fluxo MANIFEST (manifest.json gerado: mods/config com url + hash) ──
async function updateFromManifest(manifestUrl, gameDir, log, progress) {
  log('Verificando atualizações do modpack (manifest)...')
  const manifest = await fetchJSON(manifestUrl)
  const files = manifest.files || []
  const r = await applyFiles(files, gameDir, log, progress)
  const wanted = new Set(files.map((f) => f.path.replace(/\\/g, '/')))
  sweepManaged(gameDir, wanted, manifest.managed_dirs || ['mods', 'config'], log)
  return r
}

// ── Fluxo .mrpack (Modrinth): baixa o zip, lê modrinth.index.json (mods por URL
// da CDN) e extrai overrides/ (config/kubejs/etc.), instalando tudo com diff. ──
async function updateFromMrpack(mrpackUrl, gameDir, log, progress) {
  log('Baixando modpack (.mrpack)...')
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mrpack-'))
  try {
    const mrpackPath = path.join(tmpRoot, 'pack.mrpack')
    await downloadFile(mrpackUrl, mrpackPath)

    const zip = new AdmZip(mrpackPath)
    const idxEntry = zip.getEntry('modrinth.index.json')
    if (!idxEntry) throw new Error('.mrpack inválido (sem modrinth.index.json)')
    const index = JSON.parse(zip.readAsText(idxEntry))

    const files = []
    // mods/recursos por URL da CDN (pula os marcados client=unsupported)
    for (const f of index.files || []) {
      if (f.env && f.env.client === 'unsupported') continue
      const url = Array.isArray(f.downloads) ? f.downloads[0] : null
      if (!url || !f.path) continue
      files.push({ path: f.path, url, sha512: f.hashes?.sha512, sha1: f.hashes?.sha1 })
    }

    // overrides (config/kubejs/etc.) → extrai e instala por cópia (diff por hash)
    const extractDir = path.join(tmpRoot, 'x')
    zip.extractAllTo(extractDir, true)
    for (const sub of ['overrides', 'client-overrides']) {
      const base = path.join(extractDir, sub)
      if (!fs.existsSync(base)) continue
      const walk = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const abs = path.join(dir, e.name)
          if (e.isDirectory()) { walk(abs); continue }
          const rel = path.relative(base, abs).replace(/\\/g, '/')
          files.push({ path: rel, localSrc: abs })
        }
      }
      walk(base)
    }

    log(`Pack: ${files.length} arquivos. Sincronizando...`)
    const r = await applyFiles(files, gameDir, log, progress)

    // sweep nas pastas de topo presentes no pack (mods, config, kubejs, ...)
    const wanted = new Set(files.map((f) => f.path.replace(/\\/g, '/')))
    const dirs = [...new Set(files.map((f) => f.path.split('/')[0]).filter(Boolean))]
    sweepManaged(gameDir, wanted, dirs, log)
    return r
  } finally {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }) } catch { /* ignora */ }
  }
}

const isPlaceholder = (s) => !s || /SEU_|EXEMPLO|exemplo|SEU_SERVIDOR/i.test(s)

export async function checkAndUpdate(mainWindow) {
  const cfg = getConfig()
  const mrpackUrl = cfg.modpack?.mrpack_url
  const manifestUrl = cfg.modpack?.manifest_url
  const log = (msg) => send(mainWindow, 'log', msg)
  const progress = (data) => send(mainWindow, 'progress', data)
  const gameDir = getInstanceDir(getModpackInstanceId(cfg))
  const remoteVer = cfg.modpack?.version

  // B: se a versão instalada == a remota E a instância já tem mods, NÃO rebaixa
  // nada (evita rebaixar a .mrpack de 30MB à toa). Se faltar mods, segue e baixa.
  try {
    const modsDir = path.resolve(gameDir, 'mods')
    const hasMods = fs.existsSync(modsDir) && fs.readdirSync(modsDir).some((f) => f.endsWith('.jar'))
    if (remoteVer && cfg.installed_modpack_version === remoteVer && hasMods) {
      log(`Modpack já está em dia (v${remoteVer}).`)
      return { success: true, updated: false, upToDate: 0, alreadyCurrent: true }
    }
  } catch { /* qualquer erro aqui: segue pro fluxo normal de sync */ }

  try {
    let r
    if (!isPlaceholder(mrpackUrl)) {
      r = await updateFromMrpack(mrpackUrl, gameDir, log, progress)
    } else if (!isPlaceholder(manifestUrl)) {
      r = await updateFromManifest(manifestUrl, gameDir, log, progress)
    } else {
      return { success: true, updated: false, message: 'Modpack não configurado (defina modpack.mrpack_url ou manifest_url)' }
    }
    // C: marca a versão como instalada após sincronizar com sucesso (persiste no main,
    // então para de perguntar mesmo se o usuário não passar pelo botão de atualizar).
    if (remoteVer) { try { saveSettings({ installed_modpack_version: remoteVer }) } catch { /* ignora */ } }
    log(`Atualização concluída: ${r.downloaded} baixados, ${r.upToDate} em dia`)
    return { success: true, updated: r.downloaded > 0, ...r }
  } catch (err) {
    log(`Erro no updater: ${err.message}`)
    return { success: false, error: err.message }
  }
}
