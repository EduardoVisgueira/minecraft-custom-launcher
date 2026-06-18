import { useState, useEffect, useRef } from 'react'
import PlaySign from './PlaySign'
import ForgeSelector from './ForgeSelector'
import Slideshow from './Slideshow'
import RamSlider from './RamSlider'
import NewsPanel from './NewsPanel'
import SocialLinks from './SocialLinks'
import { HangingChain, CornerBolts } from './McDecor'
import ironBarsTex from '../../assets/mc-textures/iron_bars.png'
// Texturas reais (CC0) — profundidade de metal/ferrugem que CSS puro não dá.
import concreteTex from '../../assets/textures/concrete_wall_008.jpg'
import greenRustTex from '../../assets/textures/green_metal_rust.jpg'
import metalPlateTex from '../../assets/textures/metal_plate.jpg'
import metalPlate02Tex from '../../assets/textures/metal_plate_02.jpg'
import rustyMetalTex from '../../assets/textures/rusty_metal_03.jpg'
import rustyMetal02Tex from '../../assets/textures/rusty_metal_02.jpg'
import metalGrateTex from '../../assets/textures/metal_grate_rusty.jpg'
// Ícones (game-icons, fill=currentColor → recoloríveis via mask).
import hatchIcon from '../../assets/game-icons/delapouite_airtight-hatch.svg'
import knobIcon from '../../assets/game-icons/delapouite_round-knob.svg'
import valveIcon from '../../assets/game-icons/delapouite_valve.svg'
import wheelIcon from '../../assets/game-icons/delapouite_ship-wheel.svg'
import biohazardIcon from '../../assets/game-icons/lorc_biohazard.svg'
import atomCoreIcon from '../../assets/game-icons/delapouite_atom-core.svg'
import processorIcon from '../../assets/game-icons/lorc_processor.svg'
import metalBarIcon from '../../assets/game-icons/lorc_metal-bar.svg'
import gasMaskIcon from '../../assets/game-icons/lorc_gas-mask.svg'
import pipesIcon from '../../assets/game-icons/delapouite_pipes.svg'
import gearsIcon from '../../assets/game-icons/lorc_gears.svg'
import skullCrackIcon from '../../assets/game-icons/lorc_skull-crack.svg'
import cogLockIcon from '../../assets/game-icons/lorc_cog-lock.svg'
import './Home.css'

function logClass(line) {
  const l = line.toLowerCase()
  if (line.startsWith('[ERR') || l.startsWith('erro') || l.startsWith('falha') || l.includes('[error]')) return 'log-error'
  if (l.includes('[warn]') || l.startsWith('warn') || l.includes('aviso')) return 'log-warn'
  if (line.startsWith('[Launcher]') || l.includes('[info]')) return 'log-info'
  return ''
}

// Slug igual ao do backend (electron/launcher.js) pra casar o id da instância
const slugify = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()

export default function Home({ account, config, onLogout, onAccountChange }) {
  const [tab, setTab] = useState('home')
  const [newsFocus, setNewsFocus] = useState(null) // índice da transmissão aberta pela esteira
  const [ram, setRam] = useState(config?.ram?.default_mb || 4096)
  const [maxRam, setMaxRam] = useState(config?.ram?.max_mb || 16384)
  // Versão pra jogar: começa no MODPACK (default), mas dá pra trocar pra outra Forge.
  const [forgeVersion, setForgeVersion] = useState(config?.modpack?.forge_version || config?.forge_version || '')
  const [showForge, setShowForge] = useState(false)
  const [forgeAnchor, setForgeAnchor] = useState(null)
  // Instância isolada selecionada (default = a do modpack)
  const modpackSlug = slugify(config?.modpack?.name) || 'modpack'
  const [instanceId, setInstanceId] = useState(modpackSlug)
  const [launching, setLaunching] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [logs, setLogs] = useState([])
  const [progress, setProgress] = useState(null)
  const [announceClosed, setAnnounceClosed] = useState(false)
  const [installedModpack, setInstalledModpack] = useState(config?.installed_modpack_version || null)
  const [showRunning, setShowRunning] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const logsEndRef = useRef(null)

  // "Atualização disponível": a versão do modpack no config (remoto) difere da
  // última instalada localmente. Inclui a 1ª instalação (installedModpack null).
  const remoteModpack = config?.modpack?.version
  const updateAvailable = !!remoteModpack && remoteModpack !== installedModpack

  // Aviso/MOTD opcional vindo do config (faixa dispensável no topo)
  const announcement = config?.announcement
  const announceText = typeof announcement === 'string' ? announcement : announcement?.text
  const announceType = announcement?.type === 'warning' ? 'warning' : 'info'

  // Limita a alocação de RAM à memória física da máquina (reserva ~2GB p/ o SO)
  useEffect(() => {
    window.electronAPI.getSystemRam?.().then((totalMb) => {
      if (!totalMb) return
      const configMax = config?.ram?.max_mb || 16384
      const safeMax = Math.max(config?.ram?.min_mb || 2048, totalMb - 2048)
      const effectiveMax = Math.min(configMax, safeMax)
      setMaxRam(effectiveMax)
      setRam(prev => Math.min(prev, effectiveMax))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    window.electronAPI.onLog((msg) => {
      setLogs(prev => [...prev.slice(-200), msg])
    })
    window.electronAPI.onProgress((data) => {
      setProgress(data)
    })
    // jogo fechou → fecha o cofre (porta volta)
    window.electronAPI.onGameClosed?.(() => setUnlocking(false))
    return () => {
      window.electronAPI.removeAllListeners('log')
      window.electronAPI.removeAllListeners('progress')
      window.electronAPI.removeAllListeners('game-closed')
    }
  }, [])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // Escolhe o que jogar: o modpack (instância própria) ou outra versão de Forge.
  function handleSelectForge(version, inst) {
    setForgeVersion(version)
    setInstanceId(inst || version)   // modpack passa o id; versão avulsa usa a própria versão
    setShowForge(false)
  }

  async function handleUpdate() {
    setUpdating(true)
    setTab('console')
    const result = await window.electronAPI.checkUpdates()
    setUpdating(false)
    setProgress(null) // limpa a barra ao terminar (senão fica travada no último arquivo)
    if (!result.success) {
      setLogs(prev => [...prev, `Erro: ${result.error}`])
      return
    }
    const n = result.downloaded || 0
    setLogs(prev => [...prev, n > 0 ? `Modpack atualizado: ${n} arquivo(s).` : 'Modpack já estava em dia.'])
    // Marca a versão do modpack como instalada (tira o destaque do botão)
    if (remoteModpack) {
      setInstalledModpack(remoteModpack)
      window.electronAPI.saveSettings({ installed_modpack_version: remoteModpack })
    }
  }

  async function handleLaunch() {
    setUnlocking(true)
    setLaunching(true)
    setProgress(null)
    const result = await window.electronAPI.launchGame({
      username: account.username,
      uuid: account.uuid,
      accessToken: account.accessToken,
      accountType: account.type,
      ram,
      forgeVersion,
      instanceId
    })
    setLaunching(false)
    // Já existe uma instância do jogo aberta → pergunta se encerra
    if (result?.alreadyRunning) { setUnlocking(false); setShowRunning(true); return }
    if (!result.success) {
      setUnlocking(false)
      setLogs(prev => [...prev, `Falha ao iniciar: ${result.error}`])
      return
    }
    // sucesso: mantém o cofre ABERTO enquanto o jogo roda (fecha ao receber 'game-closed')
  }

  async function handleKillGame() {
    try { await window.electronAPI.killGame?.() } catch {}
    setShowRunning(false)
  }

  const isLoading = launching || updating
  const progressPct = progress
    ? Math.min(100, Math.round((progress.current / (progress.total || 1)) * 100))
    : 0

  // Abas no topo (navegação horizontal). Ícones reais à esquerda de cada aba.
  const tabItems = [
    { id: 'home', label: 'Base', icon: hatchIcon },
    { id: 'news', label: 'Transmissões', icon: atomCoreIcon },
    { id: 'console', label: 'Terminal', icon: processorIcon }
  ]

  return (
    <div className="home">
      {/* ── Navegação por ABAS no topo (substitui a sidebar) ── */}
      <nav className="tab-nav">
        <span className="tab-nav-tex" aria-hidden="true" style={{ backgroundImage: `url(${metalPlateTex})` }} />
        <div className="tab-nav-inner">
          {tabItems.map(item => (
            <button
              key={item.id}
              className={`tab-btn ${tab === item.id ? 'active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              <span className="tab-btn-icon" style={{ '--icon': `url(${item.icon})` }} aria-hidden="true" />
              <span className="tab-btn-label">{item.label}</span>
              <span className="tab-btn-underline" aria-hidden="true" />
            </button>
          ))}

          {config?.store_url && (
            <button
              className="tab-btn tab-btn--external"
              onClick={() => window.electronAPI.openExternal(config.store_url)}
            >
              <span className="tab-btn-icon" style={{ '--icon': `url(${metalBarIcon})` }} aria-hidden="true" />
              <span className="tab-btn-label">{config.store_label || 'Loja'}</span>
              <svg className="tab-btn-ext-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17L17 7M9 7h8v8" />
              </svg>
            </button>
          )}

          {/* Esteira (ticker): últimas transmissões deslizando da esquerda p/ direita.
              Clicar abre a aba Transmissões já focando a mensagem. */}
          {config?.news?.length > 0 && (
            <div className="tab-ticker">
              <div className="tab-ticker-track">
                {[...config.news, ...config.news].map((item, i) => {
                  const real = i % config.news.length
                  return (
                    <button
                      type="button"
                      className="tab-ticker-item"
                      key={i}
                      onClick={() => { setNewsFocus(real); setTab('news') }}
                      title={item.title}
                    >
                      <i className="tab-ticker-dot" />
                      {item.title}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Social links (itera só sobre os preenchidos) */}
          <SocialLinks links={config?.social_links} variant="icons" className="tab-nav-socials" />
        </div>
      </nav>

      {/* Main content = "tela" do sistema, muda por aba */}
      <main className="main-content">
        {tab === 'home' && (
          <div className="tab-home">
            {/* Slideshow como ATMOSFERA de fundo (atrás, escurecido) */}
            <div className="base-bg" aria-hidden="true">
              <Slideshow
                images={config?.slideshow_images || []}
                interval={config?.slideshow_interval_ms || 5000}
              />
              <div className="base-bg-overlay" />
              <span className="base-bg-grate" style={{ backgroundImage: `url(${metalGrateTex})` }} />
              <span className="base-bg-bars" style={{ backgroundImage: `url(${ironBarsTex})` }} />
            </div>

            {/* Correntes de quarentena penduradas no topo da BASE */}
            <div className="base-chains" aria-hidden="true">
              <HangingChain length={64} delay={0.9} />
              <HangingChain length={104} lantern />
              <HangingChain length={44} lantern delay={1.8} />
            </div>

            {announceText && !announceClosed && (
              <div className={`announce-bar announce-bar--${announceType}`}>
                <CornerBolts sm />
                <svg className="announce-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {announceType === 'warning' ? (
                    <>
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </>
                  ) : (
                    <>
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </>
                  )}
                </svg>
                <span className="announce-text">{announceText}</span>
                <button className="announce-close" onClick={() => setAnnounceClosed(true)} title="Dispensar">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}

            {/* Tela do búnker: readouts em volta do COFRE central */}
            <div className="base-screen">
              {/* Readout: status do modpack (nome + versão) + seletor de Forge */}
              <div className="base-readout base-readout--status">
                <span className="readout-eyebrow">
                  <i className="readout-dot" />
                  Zona de Quarentena · Setor Ativo
                </span>
                <h2 className="base-modpack-name">{config?.modpack?.name || 'Modpack'}</h2>
                <div className="base-badges">
                  <button
                    className="base-badge base-badge--accent base-badge--btn"
                    onClick={(e) => { setForgeAnchor(e.currentTarget.getBoundingClientRect()); setShowForge(true) }}
                    title="Escolher o que jogar (modpack ou outra versão)"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    {forgeVersion === config?.modpack?.forge_version
                      ? (config?.modpack?.name || 'Modpack')
                      : `Forge ${forgeVersion}`}
                    <svg className="base-badge-caret" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  {config?.modpack?.version && (
                    <span className="base-badge">v{config.modpack.version}</span>
                  )}
                  {config?.modpack?.version && (
                    <button
                      className={`base-dl${updateAvailable ? ' has-update' : ''}`}
                      onClick={handleUpdate}
                      disabled={!updateAvailable || updating}
                      title={updating ? 'Atualizando…' : (updateAvailable ? 'Baixar atualização do modpack' : 'Modpack em dia')}
                    >
                      <svg className={updating ? 'icon-spin' : ''} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        {updating
                          ? (<><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></>)
                          : (<><path d="M12 3v12" /><path d="m8 11 4 4 4-4" /><path d="M5 21h14" /></>)}
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Botão JOGAR — letreiro pixel-art pendurado (estilo MC) */}
              <div className="vault-stage">
                <PlaySign
                  label={config?.play_button_label || 'JOGAR'}
                  unlocking={unlocking}
                  onClick={handleLaunch}
                  disabled={isLoading || unlocking}
                />
              </div>

              {/* Readout: medidor de RAM + sincronização (à direita/abaixo) */}
              <div className="base-readout base-readout--controls">
                <div className="base-dial">
                  <span className="panel-tex" style={{ backgroundImage: `url(${metalPlate02Tex})` }} aria-hidden="true" />
                  <RamSlider
                    value={ram}
                    min={config?.ram?.min_mb || 2048}
                    max={maxRam}
                    onChange={setRam}
                  />
                </div>

                {progress && (
                  <div className="progress-bar-wrap">
                    <div className="progress-text">
                      <span className="progress-stage">{progress.text}</span>
                      <span className="progress-pct">{progressPct}%</span>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'news' && (
          <NewsPanel news={config?.news || []} focusIndex={newsFocus} />
        )}

        {tab === 'console' && (
          <div className="tab-console" style={{ '--console-tex': `url(${concreteTex})` }}>
            <div className="console-panel">
              <div className="console-header">
                <div className="console-title">
                  <span className="console-dots">
                    <i /><i /><i />
                  </span>
                  <span>Terminal de Campo</span>
                  <span className="console-rec" aria-hidden="true"><i />REC</span>
                  <span className="console-count">{logs.length} linhas</span>
                </div>
                <button className="btn-clear" onClick={() => setLogs([])}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  </svg>
                  Limpar
                </button>
              </div>
              <div className="console-body">
                {logs.length === 0 ? (
                  <div className="console-empty">
                    <span className="mask-ic console-empty-ic" style={{ '--icon': `url(${skullCrackIcon})` }} aria-hidden="true" />
                    <p>Sem transmissões</p>
                    <span>Entre na Zona ou sincronize o modpack para monitorar a atividade aqui.</span>
                  </div>
                ) : (
                  logs.map((line, i) => (
                    <div key={i} className={`log-line ${logClass(line)}`}>
                      {line}
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>
        )}
      </main>

      {showForge && (
        <ForgeSelector
          current={forgeVersion}
          modpack={config?.modpack?.forge_version ? {
            id: modpackSlug,
            name: config?.modpack?.name || 'Modpack',
            version: config?.modpack?.version,
            forge: config.modpack.forge_version
          } : null}
          anchor={forgeAnchor}
          onSelect={handleSelectForge}
          onClose={() => setShowForge(false)}
        />
      )}

      {/* Aviso: já existe uma instância do jogo aberta */}
      {showRunning && (
        <div className="run-overlay" onMouseDown={() => setShowRunning(false)}>
          <div className="run-modal" onMouseDown={(e) => e.stopPropagation()}>
            <h3>Instância já aberta</h3>
            <p>O Minecraft já está em execução. Só é possível abrir uma instância por vez.</p>
            <div className="run-actions">
              <button className="run-btn run-btn--ghost" onClick={() => setShowRunning(false)}>
                Manter aberto
              </button>
              <button className="run-btn run-btn--danger" onClick={handleKillGame}>
                Encerrar instância
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
