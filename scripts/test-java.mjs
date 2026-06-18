// Valida o download de Java buscando o manifest manualmente (https nativo),
// contornando o fetchJavaRuntimeManifest do @xmcl (incompatível com undici 7).
import path from 'node:path'
import fs from 'node:fs'
import https from 'node:https'

const ALL_URL = 'https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json'
const dest = 'C:\\tmp\\java-test\\java-runtime-gamma'
fs.mkdirSync(dest, { recursive: true })

function fetchJSON(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    https.get({ hostname: u.hostname, path: u.pathname + u.search, family: 4, headers: { 'User-Agent': 'mc-launcher' } }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 5) {
        res.resume(); return resolve(fetchJSON(res.headers.location, redirects + 1))
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode} em ${url}`)) }
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch (e) { reject(e) } })
    }).on('error', reject)
  })
}

try {
  const installer = await import('@xmcl/installer')
  const { Agent, interceptors } = await import('undici')
  const dispatcher = new Agent({
    connections: 24, connect: { timeout: 60_000, family: 4 }, headersTimeout: 60_000, bodyTimeout: 120_000
  }).compose(interceptors.redirect({ maxRedirections: 5 }))

  console.log('[java] baixando all.json (https nativo)...')
  const all = await fetchJSON(ALL_URL)
  const platform = 'windows-x64'
  const target = 'java-runtime-gamma'
  const entry = all[platform]?.[target]?.[0]
  if (!entry) throw new Error(`Sem runtime ${target} para ${platform}`)
  console.log('[java] versão:', entry.version?.name, '| manifest:', entry.manifest?.url)

  const raw = await fetchJSON(entry.manifest.url)
  const manifest = { target, files: raw.files, version: entry.version }
  console.log('[java] arquivos:', Object.keys(manifest.files).length)

  console.log('[java] installJavaRuntimeTask...')
  await installer.installJavaRuntimeTask({ destination: dest, manifest, dispatcher }).startAndWait()

  const javaw = path.join(dest, 'bin', 'javaw.exe')
  console.log('[java] javaw.exe existe:', fs.existsSync(javaw))
  console.log(fs.existsSync(javaw) ? '[java] ===== SUCESSO =====' : '[java] ===== FALHA: javaw não achado =====')
  process.exit(fs.existsSync(javaw) ? 0 : 1)
} catch (err) {
  console.error('[java] ===== FALHA =====')
  console.error(err?.message || err)
  if (Array.isArray(err?.errors)) err.errors.slice(0, 5).forEach(e => console.error('  sub:', e?.message || e))
  process.exit(1)
}
