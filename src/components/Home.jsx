import { useState, useEffect, useRef } from 'react'
import Slideshow from './Slideshow'
import RamSlider from './RamSlider'
import NewsPanel from './NewsPanel'
import AccountSelector from './AccountSelector'
import './Home.css'

export default function Home({ account, config, onLogout, onAccountChange }) {
  const [tab, setTab] = useState('home')
  const [ram, setRam] = useState(config?.ram?.default_mb || 4096)
  const [launching, setLaunching] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [logs, setLogs] = useState([])
  const [progress, setProgress] = useState(null)
  const logsEndRef = useRef(null)

  useEffect(() => {
    window.electronAPI.onLog((msg) => {
      setLogs(prev => [...prev.slice(-200), msg])
    })
    window.electronAPI.onProgress((data) => {
      setProgress(data)
    })
    return () => {
      window.electronAPI.removeAllListeners('log')
      window.electronAPI.removeAllListeners('progress')
    }
  }, [])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  async function handleUpdate() {
    setUpdating(true)
    setTab('console')
    const result = await window.electronAPI.checkUpdates()
    setUpdating(false)
    if (!result.success) {
      setLogs(prev => [...prev, `Erro: ${result.error}`])
    }
  }

  async function handleLaunch() {
    setLaunching(true)
    setTab('console')
    setProgress(null)
    const result = await window.electronAPI.launchGame({
      username: account.username,
      uuid: account.uuid,
      accessToken: account.accessToken,
      accountType: account.type,
      ram
    })
    if (!result.success) {
      setLogs(prev => [...prev, `Falha ao iniciar: ${result.error}`])
    }
    setLaunching(false)
  }

  const isLoading = launching || updating

  return (
    <div className="home">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span>{config?.launcher_name || 'MC'}</span>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${tab === 'home' ? 'active' : ''}`}
            onClick={() => setTab('home')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Início
          </button>

          <button
            className={`nav-item ${tab === 'news' ? 'active' : ''}`}
            onClick={() => setTab('news')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2zm0 0a2 2 0 01-2-2v-9c0-1.1.9-2 2-2h2"/>
              <path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/>
            </svg>
            Novidades
          </button>

          {config?.store_url && (
            <button
              className="nav-item"
              onClick={() => window.electronAPI.openExternal(config.store_url)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 01-8 0"/>
              </svg>
              Loja
            </button>
          )}

          <button
            className={`nav-item ${tab === 'console' ? 'active' : ''}`}
            onClick={() => setTab('console')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="4 17 10 11 4 5"/>
              <line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
            Console
          </button>
        </nav>

        {/* Social links */}
        {config?.social_links && (
          <div className="sidebar-socials">
            {config.social_links.discord && (
              <button
                className="social-btn"
                title="Discord"
                onClick={() => window.electronAPI.openExternal(config.social_links.discord)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/>
                </svg>
              </button>
            )}
            {config.social_links.youtube && (
              <button
                className="social-btn"
                title="YouTube"
                onClick={() => window.electronAPI.openExternal(config.social_links.youtube)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Account section */}
        <div className="sidebar-account">
          <AccountSelector
            account={account}
            onLogout={onLogout}
            onAccountChange={onAccountChange}
          />
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        {tab === 'home' && (
          <div className="tab-home">
            <div className="home-hero">
              <Slideshow
                images={config?.slideshow_images || []}
                interval={config?.slideshow_interval_ms || 5000}
              />
              <div className="hero-overlay" />
              <div className="hero-text">
                <h2>{config?.modpack?.name || 'Modpack'}</h2>
                <span className="hero-version">Forge {config?.forge_version}</span>
              </div>
            </div>

            <div className="launch-panel">
              <RamSlider
                value={ram}
                min={config?.ram?.min_mb || 2048}
                max={config?.ram?.max_mb || 16384}
                onChange={setRam}
              />

              <div className="launch-actions">
                <button
                  className="btn-update"
                  onClick={handleUpdate}
                  disabled={isLoading}
                  title="Sincronizar modpack"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 4 23 10 17 10"/>
                    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                  </svg>
                  {updating ? 'Atualizando...' : 'Atualizar'}
                </button>

                <button
                  className="btn-launch"
                  onClick={handleLaunch}
                  disabled={isLoading}
                >
                  {launching ? (
                    <>
                      <span className="spinner-sm-dark" />
                      Iniciando...
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                      Jogar
                    </>
                  )}
                </button>
              </div>

              {progress && (
                <div className="progress-bar-wrap">
                  <div className="progress-text">{progress.text}</div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.min(100, (progress.current / (progress.total || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'news' && (
          <NewsPanel news={config?.news || []} />
        )}

        {tab === 'console' && (
          <div className="tab-console">
            <div className="console-header">
              <span>Console</span>
              <button className="btn-clear" onClick={() => setLogs([])}>Limpar</button>
            </div>
            <div className="console-body">
              {logs.map((line, i) => (
                <div key={i} className={`log-line ${line.startsWith('[ERR') || line.startsWith('Erro') ? 'log-error' : ''}`}>
                  {line}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
