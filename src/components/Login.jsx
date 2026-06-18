import { useState } from 'react'
import Slideshow from './Slideshow'
import SocialLinks from './SocialLinks'
import { HangingChain } from './McDecor'
import grassSideTex from '../../assets/mc-textures/grass_block_side.png'
import gasMaskIcon from '../../assets/game-icons/lorc_gas-mask.svg'
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

      {/* Chão decorativo de grama (textura real, repetida na horizontal) */}
      <div
        className="login-ground"
        aria-hidden="true"
        style={{ backgroundImage: `url(${grassSideTex})` }}
      />

      {/* Correntes penduradas — balançam ao passar o mouse */}
      <div className="login-chains login-chains--right" aria-hidden="true">
        <HangingChain length={84} delay={1.2} />
        <HangingChain length={132} lantern soul />
      </div>
      <div className="login-chains login-chains--left" aria-hidden="true">
        <HangingChain length={64} delay={0.5} />
      </div>

      <div className="login-content">
        <div className="login-logo">
          <div className="login-mark">
            {config?.theme?.logo_url ? (
              <img src={config.theme.logo_url} alt="" className="login-mark-img" />
            ) : (
            <svg width="46" height="46" viewBox="0 0 120 120" shapeRendering="crispEdges">
              <polygon points="60,16 104,40 60,64 16,40" fill="#7cbd56" />
              <polygon points="60,24 72,31 60,38 48,31" fill="#8fd368" />
              <polygon points="40,36 52,43 40,50 28,43" fill="#6fae4c" opacity="0.8" />
              <polygon points="80,36 92,43 80,50 68,43" fill="#6fae4c" opacity="0.8" />
              <polygon points="16,40 60,64 60,108 16,84" fill="#8a5a36" />
              <polygon points="16,40 60,64 60,72 16,48" fill="#5fa33f" />
              <polygon points="26,58 38,65 38,77 26,70" fill="#76492a" opacity="0.7" />
              <polygon points="42,72 52,78 52,90 42,84" fill="#9d6b44" opacity="0.6" />
              <polygon points="60,64 104,40 104,84 60,108" fill="#724a2c" />
              <polygon points="60,64 104,40 104,48 60,72" fill="#4f8f3b" />
              <polygon points="70,66 82,59 82,71 70,78" fill="#5e3c22" opacity="0.7" />
              <polygon points="86,56 96,50 96,62 86,68" fill="#83562f" opacity="0.6" />
            </svg>
            )}
          </div>
          <h1>{config?.launcher_name || 'MC Launcher'}</h1>
        </div>

        <div className="login-card">
          {/* Parafusos 3D nos cantos chanfrados (TR/BL; colchetes em TL/BR) */}
          <span className="bolt login-card-bolt login-card-bolt--tr" aria-hidden="true" />
          <span className="bolt login-card-bolt login-card-bolt--bl" aria-hidden="true" />
          {!mode && (
            <>
              <span className="login-eyebrow">
                <span className="mask-ic login-eyebrow-ic" style={{ '--icon': `url(${gasMaskIcon})` }} aria-hidden="true" />
                <i className="login-eyebrow-dot" />
                Acesso ao Sistema · Setor 7
              </span>
              <h2>{config?.login_title || 'Bem-vindo de volta'}</h2>
              <p className="login-sub">{config?.login_subtitle || 'Escolha como deseja entrar'}</p>

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
                Entrar com Microsoft
                <span className="btn-ms-tag">Premium</span>
              </button>

              <div className="divider"><span>ou</span></div>

              <button className="btn-offline" onClick={() => setMode('offline')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
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

        <SocialLinks links={config?.social_links} variant="labels" className="login-socials" />
      </div>
    </div>
  )
}
