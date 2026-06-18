import { useState, useEffect, useMemo, useRef } from 'react'
import { CornerBolts } from './McDecor'
import rustCoarseTex from '../../assets/textures/rust_coarse_01.jpg'
import './ForgeSelector.css'

// Pontuação fuzzy: substring exata vale mais; senão casa os caracteres em ordem
// (subsequence) e bonifica chars consecutivos. Retorna 0 se não casar tudo.
function fuzzyScore(query, text) {
  const q = query.toLowerCase().replace(/\s+/g, '')
  const t = text.toLowerCase()
  if (!q) return 1
  const idx = t.indexOf(q)
  if (idx >= 0) return 1000 - idx
  let qi = 0, score = 0, last = -2
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) { score += (i === last + 1 ? 3 : 1); last = i; qi++ }
  }
  return qi === q.length ? score : 0
}

const IconCheck = () => (
  <svg className="forge-ic forge-ic--ok" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)
const IconDownload = () => (
  <svg className="forge-ic forge-ic--dl" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 4v10m0 0 4-4m-4 4-4-4" /><path d="M5 19h14" />
  </svg>
)

export default function ForgeSelector({ current, anchor, onSelect, onClose, modpack }) {
  const [query, setQuery] = useState('')
  const [versions, setVersions] = useState([])
  const [installed, setInstalled] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    window.electronAPI.getInstalledForge?.().then((l) => setInstalled(l || [])).catch(() => {})
    window.electronAPI.getForgeVersions?.()
      .then((res) => {
        if (res?.success) setVersions(res.versions || [])
        else setError(res?.error || 'Falha ao carregar versões')
        setLoading(false)
      })
      .catch((e) => { setError(e.message); setLoading(false) })
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const installedSet = useMemo(() => new Set(installed), [installed])

  const results = useMemo(() => {
    if (!versions.length) return []
    if (!query.trim()) return versions.slice(0, 200)
    return versions
      .map((v) => ({ v, s: fuzzyScore(query, v) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 200)
      .map((x) => x.v)
  }, [versions, query])

  const W = 280
  const style = anchor
    ? {
        top: Math.min(anchor.bottom + 8, window.innerHeight - 360),
        left: Math.min(anchor.left, window.innerWidth - W - 16)
      }
    : { top: 90, left: 40 }

  const Item = (v) => (
    <button
      key={v}
      className={'forge-pop-item' + (v === current ? ' is-current' : '')}
      onClick={() => onSelect(v)}
    >
      <span className="forge-pop-v">{v}</span>
      {installedSet.has(v) ? <IconCheck /> : <IconDownload />}
    </button>
  )

  // Sem busca: instalados destacados no topo; demais abaixo (sem rótulo redundante).
  const showGroups = !query.trim() && installed.length > 0
  const installedShown = showGroups ? results.filter((v) => installedSet.has(v)) : []
  const rest = showGroups ? results.filter((v) => !installedSet.has(v)) : results

  return (
    <div className="forge-pop-overlay" onMouseDown={onClose}>
      <div className="forge-pop" style={style} onMouseDown={(e) => e.stopPropagation()}>
        {/* Chapa: textura de ferrugem real */}
        <span className="panel-tex" style={{ backgroundImage: `url(${rustCoarseTex})` }} aria-hidden="true" />
        <div className="forge-pop-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar versão…"
            spellCheck={false}
          />
          {query && <button className="forge-pop-clear" onClick={() => setQuery('')} aria-label="Limpar">×</button>}
        </div>

        <div className="forge-pop-list">
          {/* Modpack como opção principal de jogo (no topo) */}
          {modpack && !query.trim() && (
            <>
              <div className="forge-pop-group">Modpack</div>
              <button
                className={'forge-pop-item forge-pop-item--modpack' + (modpack.forge === current ? ' is-current' : '')}
                onClick={() => onSelect(modpack.forge, modpack.id)}
              >
                <span className="forge-pop-v">
                  {modpack.name}{modpack.version ? ` · v${modpack.version}` : ''}
                  <small style={{ display: 'block', opacity: 0.6, fontSize: '11px', fontWeight: 400 }}>
                    Forge {modpack.forge}
                  </small>
                </span>
                <IconCheck />
              </button>
              <div className="forge-pop-sep" />
            </>
          )}
          {loading && <div className="forge-pop-state">Carregando…</div>}
          {error && <div className="forge-pop-state forge-pop-state--error">{error}</div>}
          {!loading && !error && results.length === 0 && (
            <div className="forge-pop-state">Nada encontrado</div>
          )}

          {!loading && !error && showGroups && installedShown.length > 0 && (
            <>
              <div className="forge-pop-group">Instalados</div>
              {installedShown.map(Item)}
              <div className="forge-pop-sep" />
            </>
          )}
          {!loading && !error && rest.map(Item)}
        </div>
      </div>
    </div>
  )
}
