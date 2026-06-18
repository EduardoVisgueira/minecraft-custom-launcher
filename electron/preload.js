import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  refreshConfig: () => ipcRenderer.invoke('refresh-config'),
  saveSettings: (s) => ipcRenderer.invoke('save-settings', s),

  authMicrosoft: () => ipcRenderer.invoke('auth-microsoft'),
  authOffline: (username) => ipcRenderer.invoke('auth-offline', username),
  getAccounts: () => ipcRenderer.invoke('get-accounts'),
  setActiveAccount: (uuid) => ipcRenderer.invoke('set-active-account', uuid),
  removeAccount: (uuid) => ipcRenderer.invoke('remove-account', uuid),

  launchGame: (opts) => ipcRenderer.invoke('launch-game', opts),
  killGame: () => ipcRenderer.invoke('kill-game'),
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  getSystemRam: () => ipcRenderer.invoke('get-system-ram'),
  getForgeVersions: () => ipcRenderer.invoke('get-forge-versions'),
  getInstalledForge: () => ipcRenderer.invoke('get-installed-forge'),

  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),

  onGameClosed: (cb) => ipcRenderer.on('game-closed', () => cb()),
  onLog: (cb) => ipcRenderer.on('log', (_, msg) => cb(msg)),
  onProgress: (cb) => ipcRenderer.on('progress', (_, data) => cb(data)),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
})
