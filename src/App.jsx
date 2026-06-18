import { useState, useEffect } from 'react'
import SystemBar from './components/SystemBar'
import StatusBar from './components/StatusBar'
import Login from './components/Login'
import Home from './components/Home'
import Splash from './components/Splash'
import './App.css'

// Aplica o tema (cor de destaque) vindo do config
function applyTheme(cfg) {
  if (cfg?.theme?.accent_color) {
    document.documentElement.style.setProperty('--accent', cfg.theme.accent_color)
  }
}

export default function App() {
  const [account, setAccount] = useState(null)
  const [config, setConfig] = useState(null)
  const [syncing, setSyncing] = useState(true)

  useEffect(() => {
    let done = false

    async function init() {
      // Tenta sincronizar o config remoto; se demorar > 8s, segue com o cache/bootstrap.
      const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 8000))
      let cfg = null
      try {
        cfg = await Promise.race([window.electronAPI.refreshConfig(), timeout])
      } catch {}
      // Fallback: se o refresh falhou/expirou, lê o config mesclado do cache/bootstrap
      if (!cfg) {
        try { cfg = await window.electronAPI.getConfig() } catch {}
      }

      if (done) return
      setConfig(cfg || {})
      applyTheme(cfg)

      try {
        const { accounts, active } = await window.electronAPI.getAccounts()
        if (active) {
          const found = accounts.find(a => a.uuid === active)
          if (found) setAccount(found)
        }
      } catch {}

      setSyncing(false)
    }

    init()
    return () => { done = true }
  }, [])

  if (syncing) {
    return <Splash name={config?.launcher_name} logoUrl={config?.theme?.logo_url} />
  }

  // Nome do "OS" exibido na barra de sistema (mantém o nome do launcher do config)
  const osName = (config?.launcher_name || 'Apocalipse Z').toUpperCase()

  return (
    <div className="app">
      {/* Barra de sistema (topo) — integra TitleBar/controles de janela */}
      <SystemBar
        name={osName}
        operator={account?.username}
        online={!!account}
      />

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

      {/* Barra de status (rodapé) — só quando há operador logado */}
      {account && (
        <StatusBar
          account={account}
          config={config}
          online
          onLogout={() => setAccount(null)}
          onAccountChange={setAccount}
        />
      )}
    </div>
  )
}
