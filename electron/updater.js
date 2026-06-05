const path = require('path')
const fs = require('fs')
const https = require('https')
const crypto = require('crypto')

const config = require('./config')
const { getGameDir } = require('./launcher')

function send(win, channel, data) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, data)
}

function sha256(filePath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(filePath)) return resolve(null)
    const hash = crypto.createHash('sha256')
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
      https.get(targetUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return request(res.headers.location)
        }
        if (res.statusCode !== 200) {
          file.close()
          fs.unlink(dest + '.tmp', () => {})
          return reject(new Error(`HTTP ${res.statusCode} for ${targetUrl}`))
        }
        res.pipe(file)
        file.on('finish', () => {
          file.close(() => {
            fs.rename(dest + '.tmp', dest, resolve)
          })
        })
      }).on('error', (err) => {
        file.close()
        fs.unlink(dest + '.tmp', () => {})
        reject(err)
      })
    }
    request(url)
  })
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', (c) => { data += c })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
      })
    }).on('error', reject)
  })
}

async function checkAndUpdate(mainWindow) {
  const cfg = config.getConfig()
  const manifestUrl = cfg.modpack?.manifest_url

  if (!manifestUrl || manifestUrl.includes('SEU_SERVIDOR')) {
    return { success: true, updated: false, message: 'Manifest não configurado' }
  }

  const log = (msg) => send(mainWindow, 'log', msg)
  const progress = (data) => send(mainWindow, 'progress', data)

  try {
    log('Verificando atualizações do modpack...')
    const manifest = await fetchJSON(manifestUrl)
    const gameDir = getGameDir()
    const files = manifest.files || []

    let downloaded = 0
    let upToDate = 0

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const dest = path.join(gameDir, file.path.replace(/\//g, path.sep))

      progress({
        type: 'modpack',
        current: i + 1,
        total: files.length,
        text: `Verificando ${path.basename(file.path)}...`
      })

      const localHash = await sha256(dest)

      if (localHash !== file.sha256) {
        log(`Baixando ${path.basename(file.path)}...`)
        await downloadFile(file.url, dest)
        downloaded++
      } else {
        upToDate++
      }
    }

    // Remove arquivos que não estão mais no manifest (apenas nas pastas gerenciadas)
    const managedDirs = manifest.managed_dirs || ['mods', 'config']
    for (const dir of managedDirs) {
      const fullDir = path.join(gameDir, dir)
      if (!fs.existsSync(fullDir)) continue
      const local = fs.readdirSync(fullDir)
      for (const f of local) {
        const relative = (dir + '/' + f).replace(/\\/g, '/')
        if (!files.find(mf => mf.path === relative)) {
          fs.unlinkSync(path.join(fullDir, f))
          log(`Removido: ${f}`)
        }
      }
    }

    log(`Atualização concluída: ${downloaded} baixados, ${upToDate} em dia`)
    return { success: true, updated: downloaded > 0, downloaded, upToDate }
  } catch (err) {
    log(`Erro no updater: ${err.message}`)
    return { success: false, error: err.message }
  }
}

module.exports = { checkAndUpdate }
