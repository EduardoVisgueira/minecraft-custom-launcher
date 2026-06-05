const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveSettings: (s) => ipcRenderer.invoke('save-settings', s),

  // Auth
  authMicrosoft: () => ipcRenderer.invoke('auth-microsoft'),
  authOffline: (username) => ipcRenderer.invoke('auth-offline', username),
  getAccounts: () => ipcRenderer.invoke('get-accounts'),
  setActiveAccount: (uuid) => ipcRenderer.invoke('set-active-account', uuid),
  removeAccount: (uuid) => ipcRenderer.invoke('remove-account', uuid),

  // Game
  launchGame: (opts) => ipcRenderer.invoke('launch-game', opts),
  checkUpdates: () => ipcRenderer.invoke('check-updates'),

  // System
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),

  // Events do main process → renderer
  onLog: (cb) => ipcRenderer.on('log', (_, msg) => cb(msg)),
  onProgress: (cb) => ipcRenderer.on('progress', (_, data) => cb(data)),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
})
