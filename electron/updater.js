import path from 'path'
import fs from 'fs'
import https from 'https'
import crypto from 'crypto'
import { getConfig } from './config.js'
import { getInstanceDir, getModpackInstanceId } from './launcher.js'

function send(win, channel, data) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, data)
}

// Garante que `target` está contido dentro de `base` (anti path-traversal).
// Resolve symlinks/.. e compara com separador final para evitar prefixos colados.
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

// Hash genérico (sha256 do nosso gerador OU sha512 dos packs do Modrinth)
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

export async function checkAndUpdate(mainWindow) {
  const cfg = getConfig()
  const manifestUrl = cfg.modpack?.manifest_url
  if (!manifestUrl || manifestUrl.includes('SEU_SERVIDOR')) {
    return { success: true, updated: false, message: 'Manifest não configurado' }
  }

  const log = (msg) => send(mainWindow, 'log', msg)
  const progress = (data) => send(mainWindow, 'progress', data)

  try {
    log('Verificando atualizações do modpack...')
    const manifest = await fetchJSON(manifestUrl)
    // Espelha o pack na INSTÂNCIA do modpack (isolada), não na raiz compartilhada.
    const gameDir = getInstanceDir(getModpackInstanceId(cfg))
    const files = manifest.files || []
    let downloaded = 0, upToDate = 0

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const dest = path.resolve(gameDir, file.path.replace(/\//g, path.sep))
      // Anti path-traversal: o manifest controla file.path; rejeita escrita fora do gameDir
      if (!isInside(gameDir, dest)) {
        log(`Ignorado (caminho inseguro): ${file.path}`)
        continue
      }
      progress({ type: 'modpack', current: i + 1, total: files.length, text: `Verificando ${path.basename(file.path)}...` })
      // Aceita sha256 (nosso gerador) ou sha512 (packs .mrpack do Modrinth)
      const algo = file.sha256 ? 'sha256' : (file.sha512 ? 'sha512' : null)
      const want = file.sha256 || file.sha512 || null
      const localHash = await hashFile(dest, algo || 'sha256')
      const needs = want ? (localHash !== want) : !fs.existsSync(dest)
      if (needs) {
        log(`Baixando ${path.basename(file.path)}...`)
        await downloadFile(file.url, dest)
        // Verifica integridade do arquivo baixado; se divergir, remove e aborta
        if (want) {
          const newHash = await hashFile(dest, algo)
          if (newHash !== want) {
            fs.unlinkSync(dest)
            throw new Error(`Hash divergente em ${file.path} (arquivo rejeitado)`)
          }
        }
        downloaded++
      } else {
        upToDate++
      }
    }

    // Limpeza: remove ARQUIVOS nas pastas gerenciadas que não estão no manifest.
    // Ignora pastas que começam com '.' (ex.: .connector, dados de runtime de mods)
    // e nunca tenta apagar diretório (evita EPERM no Windows). Recursivo p/ subpastas.
    const wanted = new Set(files.map((f) => f.path.replace(/\\/g, '/')))
    const sweep = (root) => {
      for (const e of fs.readdirSync(root, { withFileTypes: true })) {
        if (e.name.startsWith('.')) continue // pula .connector/.index/etc (runtime)
        const abs = path.join(root, e.name)
        if (e.isDirectory()) { sweep(abs); continue }
        if (!isInside(gameDir, abs)) continue
        const rel = path.relative(gameDir, abs).replace(/\\/g, '/')
        if (!wanted.has(rel)) {
          try { fs.unlinkSync(abs); log(`Removido: ${rel}`) } catch { /* lock/perm: ignora */ }
        }
      }
    }
    const managedDirs = manifest.managed_dirs || ['mods', 'config']
    for (const dir of managedDirs) {
      const fullDir = path.resolve(gameDir, dir)
      // Anti path-traversal: managed_dirs vem do manifest; só varre dentro do gameDir
      if (!isInside(gameDir, fullDir) || !fs.existsSync(fullDir)) continue
      sweep(fullDir)
    }

    log(`Atualização concluída: ${downloaded} baixados, ${upToDate} em dia`)
    return { success: true, updated: downloaded > 0, downloaded, upToDate }
  } catch (err) {
    log(`Erro no updater: ${err.message}`)
    return { success: false, error: err.message }
  }
}
