import { BrowserWindow, app, safeStorage } from 'electron'
import path from 'path'
import fs from 'fs'
import https from 'https'
import crypto from 'crypto'

// Prefixo que marca um valor cifrado em repouso (DPAPI via safeStorage).
const ENC_PREFIX = 'enc:v1:'

function canEncrypt() {
  try { return safeStorage.isEncryptionAvailable() } catch { return false }
}

// Cifra um token (texto puro) -> "enc:v1:<base64>". Se indisponível, mantém em claro.
function encField(value) {
  if (!value || typeof value !== 'string') return value
  if (value.startsWith(ENC_PREFIX)) return value
  if (!canEncrypt()) return value
  try { return ENC_PREFIX + safeStorage.encryptString(value).toString('base64') }
  catch { return value }
}

// Decifra "enc:v1:<base64>" -> texto puro. Retrocompatível com tokens em claro.
function decField(value) {
  if (!value || typeof value !== 'string' || !value.startsWith(ENC_PREFIX)) return value
  try { return safeStorage.decryptString(Buffer.from(value.slice(ENC_PREFIX.length), 'base64')) }
  catch { return value }
}

function encryptAccount(acc) {
  return { ...acc, accessToken: encField(acc.accessToken), refreshToken: encField(acc.refreshToken) }
}

function decryptAccount(acc) {
  return { ...acc, accessToken: decField(acc.accessToken), refreshToken: decField(acc.refreshToken) }
}

const CLIENT_ID = '00000000402b5328'
const REDIRECT_URI = 'https://login.live.com/oauth20_desktop.srf'

function getAccountsFile() {
  return path.join(app.getPath('userData'), 'accounts.json')
}

function loadAccounts() {
  try {
    const file = getAccountsFile()
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'))
      // Decifra tokens em repouso (retrocompatível com arquivos antigos em claro)
      if (Array.isArray(data.accounts)) data.accounts = data.accounts.map(decryptAccount)
      return data
    }
  } catch {}
  return { accounts: [], active: null }
}

function saveAccounts(data) {
  const file = getAccountsFile()
  const dir = path.dirname(file)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  // Cifra tokens antes de gravar (DPAPI via safeStorage quando disponível)
  const toSave = {
    ...data,
    accounts: Array.isArray(data.accounts) ? data.accounts.map(encryptAccount) : data.accounts
  }
  fs.writeFileSync(file, JSON.stringify(toSave, null, 2))
}

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

async function exchangeCode(code) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID, code,
    grant_type: 'authorization_code', redirect_uri: REDIRECT_URI
  }).toString()
  return post('https://login.live.com/oauth20_token.srf', body)
}

async function getXBL(msAccessToken) {
  return post('https://user.auth.xboxlive.com/user/authenticate', {
    Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: `d=${msAccessToken}` },
    RelyingParty: 'http://auth.xboxlive.com', TokenType: 'JWT'
  })
}

async function getXSTS(xblToken) {
  return post('https://xsts.auth.xboxlive.com/xsts/authorize', {
    Properties: { SandboxId: 'RETAIL', UserTokens: [xblToken] },
    RelyingParty: 'rp://api.minecraftservices.com/', TokenType: 'JWT'
  })
}

async function getMCToken(xstsToken, userHash) {
  return post('https://api.minecraftservices.com/authentication/login_with_xbox',
    { identityToken: `XBL3.0 x=${userHash};${xstsToken}` })
}

async function getMCProfile(mcToken) {
  return get('https://api.minecraftservices.com/minecraft/profile', {
    Authorization: `Bearer ${mcToken}`
  })
}

export async function loginMicrosoft(parentWindow) {
  return new Promise((resolve, reject) => {
    // state aleatório: proteção CSRF do fluxo OAuth (validado no retorno)
    const state = crypto.randomBytes(16).toString('hex')
    const authURL =
      `https://login.live.com/oauth20_authorize.srf` +
      `?client_id=${CLIENT_ID}&response_type=code` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&scope=XboxLive.signin%20offline_access&prompt=select_account` +
      `&state=${state}`

    const win = new BrowserWindow({
      width: 520, height: 640, parent: parentWindow, modal: true,
      autoHideMenuBar: true,        // tira a barra "File/Edit/View..." da janela de login
      title: 'Entrar com a Microsoft',
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
    })
    win.removeMenu()                // remove de vez o menu (Windows)

    win.loadURL(authURL)
    let handled = false

    win.webContents.on('did-navigate', async (_, url) => {
      if (handled || !url.startsWith(REDIRECT_URI)) return
      handled = true
      const parsed = new URL(url)
      const code = parsed.searchParams.get('code')
      const error = parsed.searchParams.get('error')
      const returnedState = parsed.searchParams.get('state')
      win.close()
      // Valida o state contra CSRF antes de usar o code
      if (returnedState !== state) return reject(new Error('OAuth state inválido (possível CSRF)'))
      if (error || !code) return reject(new Error(error || 'No code received'))
      try {
        const ms = await exchangeCode(code)
        const xbl = await getXBL(ms.access_token)
        const xsts = await getXSTS(xbl.Token)
        const userHash = xsts.DisplayClaims?.xui?.[0]?.uhs
        const mc = await getMCToken(xsts.Token, userHash)
        const profile = await getMCProfile(mc.access_token)
        if (!profile.id) throw new Error('Conta não possui Minecraft. Compre em minecraft.net')
        const account = {
          type: 'microsoft', uuid: profile.id, username: profile.name,
          accessToken: mc.access_token, refreshToken: ms.refresh_token,
          expiresAt: Date.now() + ms.expires_in * 1000
        }
        const data = loadAccounts()
        const idx = data.accounts.findIndex(a => a.uuid === account.uuid)
        if (idx >= 0) data.accounts[idx] = account
        else data.accounts.push(account)
        data.active = account.uuid
        saveAccounts(data)
        resolve({ success: true, account })
      } catch (err) { reject(err) }
    })
    win.on('closed', () => { if (!handled) reject(new Error('Login cancelado')) })
  })
}

export function loginOffline(username) {
  const trimmed = (username || '').trim()
  if (trimmed.length < 3 || trimmed.length > 16) {
    return { success: false, error: 'Nome deve ter entre 3 e 16 caracteres' }
  }
  const uuid = 'offline-' + Buffer.from(trimmed.toLowerCase()).toString('hex').padEnd(28, '0').substring(0, 28)
  const account = { type: 'offline', uuid, username: trimmed, accessToken: '0', refreshToken: null }
  const data = loadAccounts()
  const idx = data.accounts.findIndex(a => a.uuid === uuid)
  if (idx >= 0) data.accounts[idx] = account
  else data.accounts.push(account)
  data.active = uuid
  saveAccounts(data)
  return { success: true, account }
}

// Troca o refresh_token por um novo access_token (renovação silenciosa)
async function refreshMSToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID, refresh_token: refreshToken,
    grant_type: 'refresh_token', redirect_uri: REDIRECT_URI
  }).toString()
  return post('https://login.live.com/oauth20_token.srf', body)
}

// Renova a sessão Minecraft de uma conta Microsoft usando o refreshToken salvo,
// refazendo a cadeia XBL -> XSTS -> MC token. Atualiza e persiste a conta.
export async function refreshMicrosoft(uuid) {
  const data = loadAccounts()
  const idx = data.accounts.findIndex(a => a.uuid === uuid)
  const account = data.accounts[idx]
  if (!account || account.type !== 'microsoft' || !account.refreshToken) {
    return { success: false, error: 'Conta Microsoft inválida para refresh' }
  }
  try {
    const ms = await refreshMSToken(account.refreshToken)
    if (!ms.access_token) throw new Error('Sessão expirada — faça login novamente')
    const xbl = await getXBL(ms.access_token)
    const xsts = await getXSTS(xbl.Token)
    const userHash = xsts.DisplayClaims?.xui?.[0]?.uhs
    const mc = await getMCToken(xsts.Token, userHash)
    if (!mc.access_token) throw new Error('Falha ao renovar token do Minecraft')
    account.accessToken = mc.access_token
    account.refreshToken = ms.refresh_token || account.refreshToken
    account.expiresAt = Date.now() + (ms.expires_in || 3600) * 1000
    data.accounts[idx] = account
    saveAccounts(data)
    return { success: true, account }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// Garante um accessToken válido antes de lançar o jogo. Offline sempre OK.
// Microsoft: renova se expirado (ou faltando < 1min).
export async function ensureValidToken(uuid) {
  const data = loadAccounts()
  const account = data.accounts.find(a => a.uuid === uuid)
  if (!account) return { success: false, error: 'Conta não encontrada' }
  if (account.type !== 'microsoft') return { success: true, account }
  if (account.expiresAt && account.expiresAt > Date.now() + 60_000) {
    return { success: true, account }
  }
  return refreshMicrosoft(uuid)
}

export function getAccounts() { return loadAccounts() }
export function setActiveAccount(uuid) {
  const data = loadAccounts(); data.active = uuid; saveAccounts(data); return { success: true }
}
export function removeAccount(uuid) {
  const data = loadAccounts()
  data.accounts = data.accounts.filter(a => a.uuid !== uuid)
  if (data.active === uuid) data.active = data.accounts[0]?.uuid || null
  saveAccounts(data)
  return { success: true }
}
