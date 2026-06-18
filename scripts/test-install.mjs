// Diagnóstico standalone da instalação Minecraft + Forge (sem Electron/UI).
// Reproduz exatamente o fluxo do launcher.js e imprime os SUB-ERROS de um
// AggregateError (que normalmente vêm vazios em err.message), revelando a
// causa real da falha (404, hash mismatch, timeout, ECONNRESET, etc.).
//
// Uso: node scripts/test-install.mjs

import path from 'node:path'
import fs from 'node:fs'

const mcVersion = '1.20.1'
const forgeNum = '47.4.10'
const versionId = `${mcVersion}-forge-${forgeNum}`
const javaPath = 'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.17.10-hotspot\\bin\\javaw.exe'

// Reaproveita o que o app já baixou, se existir; senão usa um dir de teste limpo.
const candidates = [
  path.join(process.env.APPDATA || '', 'minecraft-custom-launcher', 'minecraft'),
  path.join(process.env.APPDATA || '', 'MC Launcher', 'minecraft'),
  'C:\\tmp\\mc-forge-test'
]
const existing = candidates.find(d => fs.existsSync(path.join(d, 'versions', mcVersion)))
const gameDir = existing || 'C:\\tmp\\mc-forge-test'
fs.mkdirSync(gameDir, { recursive: true })

function dump(err, depth = 0) {
  const pad = '  '.repeat(depth)
  if (!err) { console.error(pad + '(null)'); return }
  console.error(`${pad}• ${err.name || 'Error'}: ${err.message || String(err)}`)
  if (err.code) console.error(`${pad}  code: ${err.code}`)
  if (err.status || err.statusCode) console.error(`${pad}  status: ${err.status || err.statusCode}`)
  if (err.url) console.error(`${pad}  url: ${err.url}`)
  if (err.path || err.file || err.destination) console.error(`${pad}  path: ${err.path || err.file || err.destination}`)
  if (Array.isArray(err.errors) && err.errors.length) {
    console.error(`${pad}  sub-erros (${err.errors.length}):`)
    err.errors.slice(0, 10).forEach(e => dump(e, depth + 2))
  }
  if (err.cause) { console.error(`${pad}  cause:`); dump(err.cause, depth + 2) }
}

async function main() {
  console.log(`[test] gameDir = ${gameDir} (reuso: ${!!existing})`)
  console.log(`[test] Java = ${javaPath} (existe: ${fs.existsSync(javaPath)})`)

  const { Version } = await import('@xmcl/core')
  const inst = await import('@xmcl/installer')
  const { getVersionList, installVersion, installForge, installDependencies, installAssets, installLibraries } = inst
  const { Agent, interceptors } = await import('undici')

  // Dispatcher: IPv4 forçado (evita timeouts de IPv6) + redirect interceptor
  // (o @xmcl lê context.history dos redirects; sem ele dá TypeError). NÃO usamos
  // retry-via-range (RetryAgent/interceptors.retry) porque o resume via header
  // Range colide com a validação do @xmcl -> "content-range mismatch".
  const dispatcher = new Agent({
    connections: 24,
    connect: { timeout: 60_000, family: 4 },
    headersTimeout: 60_000,
    bodyTimeout: 120_000
  }).compose(interceptors.redirect({ maxRedirections: 5 }))

  console.log('[test] dispatcher: Agent IPv4 + redirect (sem retry-via-range)')

  // Remove downloads anteriores corrompidos (0 bytes / .pending) que sabotam o resume.
  const cleanCorrupt = (dir) => {
    if (!fs.existsSync(dir)) return 0
    let n = 0
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) n += cleanCorrupt(p)
      else if (e.name.endsWith('.pending') || fs.statSync(p).size === 0) { fs.unlinkSync(p); n++ }
    }
    return n
  }
  const removed = cleanCorrupt(path.join(gameDir, 'assets', 'objects'))
  console.log(`[test] arquivos corrompidos removidos: ${removed}`)

  console.log('[test] 1/5 getVersionList...')
  const list = await getVersionList()
  const mcMeta = list.versions.find(v => v.id === mcVersion)
  if (!mcMeta) throw new Error(`MC ${mcVersion} não encontrado na lista`)

  console.log('[test] 2/5 installVersion (Minecraft base)...')
  await installVersion(mcMeta, gameDir)

  console.log('[test] 3/5 installForge...')
  const forgeResult = await installForge({ mcversion: mcVersion, version: forgeNum }, gameDir, { java: javaPath })
  console.log('[test]   installForge ->', forgeResult)

  console.log('[test] 4/5 Version.parse...')
  const resolved = await Version.parse(gameDir, versionId)
  console.log('[test]   resolved libs:', resolved.libraries?.length, '| mainClass:', resolved.mainClass)

  // Separa assets de libraries para isolar qual etapa gera o AggregateError
  console.log('[test] 5a/5 installLibraries...')
  await installLibraries(resolved, { dispatcher })
  console.log('[test]   libraries OK')

  console.log('[test] 5b/5 installAssets (com dispatcher resiliente)...')
  await installAssets(resolved, { dispatcher })
  console.log('[test]   assets OK')

  console.log('[test] ===== SUCESSO TOTAL =====')
}

main().catch(err => {
  console.error('\n[test] ===== FALHA =====')
  dump(err)
  process.exit(1)
})
