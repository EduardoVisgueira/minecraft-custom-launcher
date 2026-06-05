const { BrowserWindow, app } = require('electron')
const path = require('path')
const fs = require('fs')
const https = require('https')

const CLIENT_ID = '00000000402b5328'
const REDIRECT_URI = 'https://login.live.com/oauth20_desktop.srf'
const ACCOUNTS_FILE = path.join(app.getPath('userData'), 'accounts.json')

// ─── Storage ─────────────────────────────────────────────────────────────────

function loadAccounts() {
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf-8'))
    }
  } catch {}
  return { accounts: [], active: null }
}

function saveAccounts(data) {
  const dir = path.dirname(ACCOUNTS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(data, null, 2))
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function post(url, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const isForm = typeof body === 'string'
    const bodyStr = isForm ? body : JSON.stringify(body)
    const parsed = new URL(url)
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': isForm ? 'application/x-www-form-urlencoded' : 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        Accept: 'application/json',
        ...extraHeaders
      }
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (c) => { data += c })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { resolve(data) }
      })
    })
    req.on('error', reject)
    req.write(bodyStr)
    req.end()
  })
}

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: { Accept: 'application/json', ...headers }
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (c) => { data += c })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { resolve(data) }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

// ─── Microsoft OAuth chain ────────────────────────────────────────────────────

async function exchangeCode(code) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    code,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI
  }).toString()
  return post('https://login.live.com/oauth20_token.srf', body)
}

async function refreshToken(token) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    refresh_token: token,
    grant_type: 'refresh_token',
    redirect_uri: REDIRECT_URI
  }).toString()
  return post('https://login.live.com/oauth20_token.srf', body)
}

async function getXBL(msAccessToken) {
  return post('https://user.auth.xboxlive.com/user/authenticate', {
    Properties: {
      AuthMethod: 'RPS',
      SiteName: 'user.auth.xboxlive.com',
      RpsTicket: `d=${msAccessToken}`
    },
    RelyingParty: 'http://auth.xboxlive.com',
    TokenType: 'JWT'
  })
}

async function getXSTS(xblToken) {
  return post('https://xsts.auth.xboxlive.com/xsts/authorize', {
    Properties: { SandboxId: 'RETAIL', UserTokens: [xblToken] },
    RelyingParty: 'rp://api.minecraftservices.com/',
    TokenType: 'JWT'
  })
}

async function getMCToken(xstsToken, userHash) {
  return post(
    'https://api.minecraftservices.com/authentication/login_with_xbox',
    { identityToken: `XBL3.0 x=${userHash};${xstsToken}` }
  )
}

async function getMCProfile(mcToken) {
  return get('https://api.minecraftservices.com/minecraft/profile', {
    Authorization: `Bearer ${mcToken}`
  })
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function loginMicrosoft(parentWindow) {
  return new Promise((resolve, reject) => {
    const authURL =
      `https://login.live.com/oauth20_authorize.srf` +
      `?client_id=${CLIENT_ID}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&scope=XboxLive.signin%20offline_access` +
      `&prompt=select_account`

    const win = new BrowserWindow({
      width: 520,
      height: 640,
      parent: parentWindow,
      modal: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    })

    win.loadURL(authURL)

    let handled = false

    win.webContents.on('did-navigate', async (_, url) => {
      if (handled || !url.startsWith(REDIRECT_URI)) return
      handled = true

      const parsed = new URL(url)
      const code = parsed.searchParams.get('code')
      const error = parsed.searchParams.get('error')

      win.close()

      if (error || !code) {
        return reject(new Error(error || 'No code received'))
      }

      try {
        const ms = await exchangeCode(code)
        const xbl = await getXBL(ms.access_token)
        const xsts = await getXSTS(xbl.Token)
        const userHash = xsts.DisplayClaims?.xui?.[0]?.uhs
        const mc = await getMCToken(xsts.Token, userHash)
        const profile = await getMCProfile(mc.access_token)

        if (!profile.id) throw new Error("Conta não possui Minecraft. Compre o jogo em minecraft.net")

        const account = {
          type: 'microsoft',
          uuid: profile.id,
          username: profile.name,
          accessToken: mc.access_token,
          refreshToken: ms.refresh_token,
          expiresAt: Date.now() + ms.expires_in * 1000
        }

        const data = loadAccounts()
        const idx = data.accounts.findIndex(a => a.uuid === account.uuid)
        if (idx >= 0) data.accounts[idx] = account
        else data.accounts.push(account)
        data.active = account.uuid
        saveAccounts(data)

        resolve({ success: true, account })
      } catch (err) {
        reject(err)
      }
    })

    win.on('closed', () => {
      if (!handled) reject(new Error('Login cancelado'))
    })
  })
}

function loginOffline(username) {
  const trimmed = (username || '').trim()
  if (trimmed.length < 3 || trimmed.length > 16) {
    return { success: false, error: 'Nome deve ter entre 3 e 16 caracteres' }
  }

  const uuid = 'offline-' + Buffer.from(trimmed.toLowerCase()).toString('hex').padEnd(28, '0').substring(0, 28)

  const account = {
    type: 'offline',
    uuid,
    username: trimmed,
    accessToken: '0',
    refreshToken: null
  }

  const data = loadAccounts()
  const idx = data.accounts.findIndex(a => a.uuid === uuid)
  if (idx >= 0) data.accounts[idx] = account
  else data.accounts.push(account)
  data.active = uuid
  saveAccounts(data)

  return { success: true, account }
}

function getAccounts() {
  return loadAccounts()
}

function setActiveAccount(uuid) {
  const data = loadAccounts()
  data.active = uuid
  saveAccounts(data)
  return { success: true }
}

function removeAccount(uuid) {
  const data = loadAccounts()
  data.accounts = data.accounts.filter(a => a.uuid !== uuid)
  if (data.active === uuid) {
    data.active = data.accounts[0]?.uuid || null
  }
  saveAccounts(data)
  return { success: true }
}

module.exports = { loginMicrosoft, loginOffline, getAccounts, setActiveAccount, removeAccount }
