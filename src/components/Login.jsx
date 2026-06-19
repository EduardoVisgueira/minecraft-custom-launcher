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

          {/* login MS terminou sem sucesso (cancelado/falhou) → permite tentar de novo */}
          {mode === 'microsoft' && !loading && (
            <div className="ms-failed">
              <h2>Login Microsoft</h2>
              <p className="login-sub">Não foi possível entrar. Tente novamente.</p>
              <button className="btn-ms" onClick={handleMicrosoft}>
                <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                </svg>
                Tentar novamente
              </button>
              <button type="button" className="btn-ghost" onClick={reset}>Voltar</button>
            </div>
          )}

          {error && <p className="login-error">{error}</p>}
        </div>

        <SocialLinks links={config?.social_links} variant="labels" className="login-socials" />
      </div>
    </div>
  )
}
