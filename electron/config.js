const { app } = require('electron')
const path = require('path')
const fs = require('fs')

const CONFIG_FILE = app.isPackaged
  ? path.join(process.resourcesPath, 'launcher-config.json')
  : path.join(__dirname, '../launcher-config.json')

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json')

function getConfig() {
  let base = {}
  let settings = {}

  try {
    base = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
  } catch (e) {
    console.error('Failed to read launcher-config.json:', e.message)
  }

  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'))
    }
  } catch {}

  return { ...base, ...settings }
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2))
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

module.exports = { getConfig, saveSettings }
