import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import https from 'https'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Arquivo bootstrap (embutido no app): valores de fallback + config_url
function getConfigFile() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'launcher-config.json')
    : path.join(__dirname, '../../launcher-config.json')
}

// Settings do usuário (RAM, forge escolhido, etc.)
function getSettingsFile() {
  return path.join(app.getPath('userData'), 'settings.json')
}

// Cache do config remoto baixado de config_url
function getCachedConfigFile() {
  return path.join(app.getPath('userData'), 'cached-config.json')
}

// Lê o bootstrap embutido (síncrono)
function readBootstrap() {
  try {
    return JSON.parse(fs.readFileSync(getConfigFile(), 'utf-8'))
  } catch (e) {
    console.error('Falha ao ler launcher-config.json:', e.message)
    return {}
  }
}

// Rejeita URLs que não sejam https:// (mesmo padrão do updater)
function assertHttps(url, label) {
  let u
  try { u = new URL(url) } catch { throw new Error(`${label} inválida: ${url}`) }
  if (u.protocol !== 'https:') throw new Error(`${label} deve usar https://`)
  return u
}

// Baixa JSON via https com timeout (não usa o do updater p/ evitar import circular)
function fetchJSON(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    try { assertHttps(url, 'config_url') } catch (e) { return reject(e) }
    const req = https.get(url, (res) => {
      // Segue redirects https (config hospedado pode redirecionar)
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume()
        return fetchJSON(res.headers.location, timeoutMs).then(resolve, reject)
      }
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error(`HTTP ${res.statusCode}`))
      }
      let data = ''
      res.on('data', (c) => { data += c })
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch (e) { reject(e) } })
    })
    req.on('error', reject)
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')))
  })
}

// ASSÍNCRONO: se houver config_url (https), baixa o JSON remoto e grava no cache.
// Em falha/offline, NÃO altera o cache (mantém o anterior). Nunca lança.
export async function refreshRemoteConfig() {
  const boot = readBootstrap()
  const url = boot.config_url
  if (!url || /EXEMPLO|exemplo\.com|SEU_USUARIO|SEU_REPO/i.test(url)) {
    return { success: false, skipped: true } // URL de exemplo/placeholder: ignora
  }
  try {
    const remote = await fetchJSON(url, 8000)
    if (remote && typeof remote === 'object') {
      fs.writeFileSync(getCachedConfigFile(), JSON.stringify(remote, null, 2))
      return { success: true }
    }
    return { success: false, error: 'resposta inválida' }
  } catch (e) {
    console.log('[config] config remoto indisponível, usando cache/bootstrap:', e.message)
    return { success: false, error: e.message }
  }
}

// SÍNCRONO: merge em camadas (bootstrap → cache remoto → settings do usuário).
// A UI lê instantaneamente; o fetch remoto roda à parte em refreshRemoteConfig().
export function getConfig() {
  const base = readBootstrap()

  let cached = {}
  try {
    const cf = getCachedConfigFile()
    if (fs.existsSync(cf)) cached = JSON.parse(fs.readFileSync(cf, 'utf-8'))
  } catch {}

  let settings = {}
  try {
    const sf = getSettingsFile()
    if (fs.existsSync(sf)) settings = JSON.parse(fs.readFileSync(sf, 'utf-8'))
  } catch {}

  return { ...base, ...cached, ...settings }
}

export function saveSettings(settings) {
  try {
    const sf = getSettingsFile()
    const dir = path.dirname(sf)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    // Merge com settings já gravados (não sobrescreve outros campos)
    let current = {}
    try { if (fs.existsSync(sf)) current = JSON.parse(fs.readFileSync(sf, 'utf-8')) } catch {}
    fs.writeFileSync(sf, JSON.stringify({ ...current, ...settings }, null, 2))
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
