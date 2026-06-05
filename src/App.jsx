import { useState, useEffect } from 'react'
import TitleBar from './components/TitleBar'
import Login from './components/Login'
import Home from './components/Home'
import './App.css'

export default function App() {
  const [account, setAccount] = useState(null)
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const cfg = await window.electronAPI.getConfig()
      setConfig(cfg)

      // Aplicar cor de destaque do tema
      if (cfg?.theme?.accent_color) {
        document.documentElement.style.setProperty('--accent', cfg.theme.accent_color)
      }

      const { accounts, active } = await window.electronAPI.getAccounts()
      if (active) {
        const found = accounts.find(a => a.uuid === active)
        if (found) setAccount(found)
      }

      setLoading(false)
    }
    init()
  }, [])

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className="app">
      <TitleBar title={config?.launcher_name || 'MC Launcher'} />
      {account ? (
        <Home
          account={account}
          config={config}
          onLogout={() => setAccount(null)}
          onAccountChange={setAccount}
        />
      ) : (
        <Login
          config={config}
          onLogin={setAccount}
        />
      )}
    </div>
  )
}
