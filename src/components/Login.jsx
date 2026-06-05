import { useState } from 'react'
import Slideshow from './Slideshow'
import './Login.css'

export default function Login({ config, onLogin }) {
  const [mode, setMode] = useState(null)
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleMicrosoft() {
    setLoading(true)
    setError('')
    try {
      const result = await window.electronAPI.authMicrosoft()
      if (result.success) onLogin(result.account)
      else setError(result.error || 'Login falhou')
    } catch (e) {
      setError('Login cancelado ou falhou. Tente novamente.')
    }
    setLoading(false)
  }

  async function handleOffline(e) {
    e.preventDefault()
    if (!username.trim()) return
    setLoading(true)
    const result = await window.electronAPI.authOffline(username)
    setLoading(false)
    if (result.success) onLogin(result.account)
    else setError(result.error)
  }

  function reset() {
    setMode(null)
    setError('')
    setLoading(false)
  }

  return (
    <div className="login-screen">
      <Slideshow
        images={config?.slideshow_images || []}
        interval={config?.slideshow_interval_ms || 5000}
      />

      <div
        className="login-overlay"
        style={{ '--overlay-opacity': config?.theme?.background_overlay_opacity ?? 0.75 }}
      />

      <div className="login-content">
        <div className="login-logo">
          <h1>{config?.launcher_name || 'MC Launcher'}</h1>
        </div>

        <div className="login-card">
          {!mode && (
            <>
              <h2>Entrar</h2>
              <p className="login-sub">Escolha o tipo de conta</p>

              <button
                className="btn-ms"
                onClick={() => { setMode('microsoft'); handleMicrosoft() }}
              >
                <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                </svg>
                Microsoft (Premium)
              </button>

              <div className="divider"><span>ou</span></div>

              <button className="btn-offline" onClick={() => setMode('offline')}>
                Conta Offline
              </button>
            </>
          )}

          {mode === 'offline' && (
            <form onSubmit={handleOffline}>
              <h2>Conta Offline</h2>
              <p className="login-sub">Apenas para servidores sem autenticação</p>
              <input
                type="text"
                placeholder="Nome de usuário"
                value={username}
                onChange={e => setUsername(e.target.value)}
                maxLength={16}
                autoFocus
                disabled={loading}
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || username.trim().length < 3}
              >
                {loading ? <span className="spinner-sm" /> : 'Entrar'}
              </button>
              <button type="button" className="btn-ghost" onClick={reset}>
                Voltar
              </button>
            </form>
          )}

          {mode === 'microsoft' && loading && (
            <div className="ms-waiting">
              <div className="spinner" />
              <p>Aguardando login Microsoft...</p>
              <button className="btn-ghost" onClick={reset}>Cancelar</button>
            </div>
          )}

          {error && <p className="login-error">{error}</p>}
        </div>

        {config?.social_links && (
          <div className="login-socials">
            {config.social_links.discord && (
              <button onClick={() => window.electronAPI.openExternal(config.social_links.discord)}>
                Discord
              </button>
            )}
            {config.social_links.youtube && (
              <button onClick={() => window.electronAPI.openExternal(config.social_links.youtube)}>
                YouTube
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
