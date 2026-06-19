import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import './RamSlider.css'
// textura real (grime de metal escovado) clipada no mostrador — profundidade
// que gradiente CSS não fake. Vite resolve a URL do asset no import.
import dialGrimeTex from '../../assets/textures/rusty_metal_02.jpg'
// mesma chapa do card/topo (grime via .panel-tex) — popover combina com o resto
import metalPlate02Tex from '../../assets/textures/metal_plate_02.jpg'

const STEPS = [1024, 2048, 3072, 4096, 6144, 8192, 12288, 16384]
// rótulo: GB inteiro vira "N GB"; qualquer outro valor exato mostra "N MB"
const label = (mb) => (mb % 1024 === 0 ? `${mb / 1024} GB` : `${mb} MB`)
const short = (mb) => (mb >= 1024 ? `${mb / 1024}` : `${mb}`)
const clampMb = (mb, min, max) => Math.max(min, Math.min(max, mb))

// posição (0..n-1) de um valor MB na escala de ticks UNIFORMES (interpola no
// segmento). Permite a agulha apontar valores exatos ENTRE os steps.
const fracIndexOf = (mb, steps) => {
  const n = steps.length
  if (n <= 1) return 0
  if (mb <= steps[0]) return 0
  if (mb >= steps[n - 1]) return n - 1
  for (let i = 0; i < n - 1; i++) {
    if (mb >= steps[i] && mb <= steps[i + 1]) {
      return i + (mb - steps[i]) / (steps[i + 1] - steps[i])
    }
  }
  return 0
}
// inverso: índice fracionário (0..n-1) -> MB (interpola no segmento)
const mbOfFracIndex = (fi, steps) => {
  const n = steps.length
  if (n <= 1) return steps[0] || 0
  const c = Math.max(0, Math.min(n - 1, fi))
  const i = Math.min(n - 2, Math.floor(c))
  return Math.round(steps[i] + (c - i) * (steps[i + 1] - steps[i]))
}

/**
 * Medidor de RAM = MANÔMETRO INDUSTRIAL / VÁLVULA DE ESCAPE.
 * Instrumento de metal usinado aparafusado na chapa: aro biselado (torneado),
 * mostrador rebaixado com textura real, faixa de redline âmbar→vermelho no topo,
 * agulha verde-tóxica com brilho e contrapeso. Slider fino embaixo seleciona o
 * step. Tudo em SVG p/ posicionar ticks/números na semicircunferência com precisão.
 */
export default function RamSlider({ value, min, max, onChange }) {
  const steps = STEPS.filter((s) => s >= min && s <= max)
  const n = steps.length
  // índice fracionário do valor atual (suporta valor exato entre steps)
  const fi = fracIndexOf(value, steps)
  const frac = n > 1 ? fi / (n - 1) : 0
  const rotation = -90 + frac * 180 // -90° (esq) .. +90° (dir)

  // valor exato via popover FLUTUANTE (portal → escapa do clip/chanfro do card)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const [pop, setPop] = useState({ top: 0, left: 0 })
  const gearRef = useRef(null)
  const popRef = useRef(null)
  const openConfig = () => {
    setDraft(String(value))
    const r = gearRef.current?.getBoundingClientRect()
    if (r) setPop({ top: r.bottom + 6, left: r.right })
    setEditing(true)
  }
  const commit = () => {
    const v = parseInt(draft, 10)
    if (!Number.isNaN(v)) onChange(clampMb(v, min, max))
    setEditing(false)
  }
  // fecha ao clicar fora ou apertar Esc
  useEffect(() => {
    if (!editing) return
    const onDown = (e) => {
      if (popRef.current?.contains(e.target) || gearRef.current?.contains(e.target)) return
      setEditing(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setEditing(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [editing])

  // geometria do mostrador (viewBox 200x140; centro um pouco abaixo p/ caber o aro)
  const cx = 100, cy = 104, R = 70
  // frac 0..1 -> ângulo 180°(esq) .. 0°(dir) no semicírculo superior
  const polar = (f, r) => {
    const a = Math.PI * (1 - f)
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)]
  }
  // helper p/ desenhar um arco entre duas frações num raio dado
  const arcPath = (f0, f1, r) => {
    const [x0, y0] = polar(f0, r)
    const [x1, y1] = polar(f1, r)
    return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`
  }

  const Rband = R - 4 // raio da faixa colorida (graduação)
  // limites das zonas (em fração do arco): aço → verde(ativo) → redline
  const fRed = 0.78           // início do redline (topo do arco = mais RAM)
  const fHi = frac            // até onde a agulha chegou (zona ativa verde)

  // parafusos do aro (4 pontos) — posições em coords do viewBox
  const screws = [
    { x: 26, y: 96, a: 24 },
    { x: 70, y: 38, a: -50 },
    { x: 130, y: 38, a: 38 },
    { x: 174, y: 96, a: -18 },
  ]

  return (
    <div className="ram-slider">
      {/* engrenagem no canto sup. direito: abre input de valor exato */}
      <button
        type="button"
        ref={gearRef}
        className={`ram-config-btn${editing ? ' is-active' : ''}`}
        onClick={() => (editing ? setEditing(false) : openConfig())}
        title="Definir valor exato (MB)"
        aria-label="Configurar memória RAM"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      <div className="ram-gauge">
        {/* textura de grime sob o SVG, clipada por máscara circular via CSS */}
        <span
          className="ram-gauge-tex"
          style={{ backgroundImage: `url(${dialGrimeTex})` }}
          aria-hidden="true"
        />
        <svg className="ram-gauge-svg" viewBox="0 0 200 140" aria-hidden="true">
          <defs>
            {/* metal escovado/sujo para o fundo do mostrador */}
            <filter id="rg-brushed" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0.012 0.9" numOctaves="2" seed="7" result="n" />
              <feColorMatrix in="n" type="matrix"
                values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0" result="na" />
              <feComposite in="na" in2="SourceGraphic" operator="in" />
            </filter>
            {/* brilho da agulha */}
            <filter id="rg-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feDropShadow dx="0" dy="0" stdDeviation="2.4" floodColor="#84cc16" floodOpacity="0.9" />
            </filter>
            <radialGradient id="rg-face" cx="42%" cy="32%" r="80%">
              <stop offset="0%" stopColor="#23271f" />
              <stop offset="58%" stopColor="#15170f" />
              <stop offset="100%" stopColor="#090a06" />
            </radialGradient>
            <linearGradient id="rg-bezel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#454a40" />
              <stop offset="42%" stopColor="#23261f" />
              <stop offset="100%" stopColor="#0c0d09" />
            </linearGradient>
            <radialGradient id="rg-hub" cx="38%" cy="32%" r="75%">
              <stop offset="0%" stopColor="#3a4032" />
              <stop offset="60%" stopColor="#1c1f17" />
              <stop offset="100%" stopColor="#0a0b07" />
            </radialGradient>
          </defs>

          {/* ── ARO USINADO (anéis concêntricos = torneado) ── */}
          <circle className="rg-bezel-outer" cx={cx} cy={cy} r={R + 18} />
          <circle className="rg-bezel-mid" cx={cx} cy={cy} r={R + 11} />
          <circle className="rg-bezel-inner" cx={cx} cy={cy} r={R + 5} />

          {/* ── MOSTRADOR REBAIXADO ── */}
          <circle className="rg-face" cx={cx} cy={cy} r={R + 1} />
          <circle className="rg-face-brushed" cx={cx} cy={cy} r={R + 1} filter="url(#rg-brushed)" />
          {/* sombra interna do mostrador afundado */}
          <circle className="rg-face-shadow" cx={cx} cy={cy} r={R + 1} />

          {/* ── FAIXA DE GRADUAÇÃO (zonas) ── */}
          {/* base aço (todo o arco) */}
          <path className="rg-band-steel" d={arcPath(0, 1, Rband)} />
          {/* redline âmbar→vermelho no topo (mais RAM = mais "pressão") */}
          <path className="rg-band-red" d={arcPath(fRed, 1, Rband)} />
          {/* zona ativa verde-tóxica até a agulha */}
          {fHi > 0 && <path className="rg-band-active" d={arcPath(0, fHi, Rband)} />}

          {/* ── TICKS (maior nos valores, número GB) ── */}
          {steps.map((s, i) => {
            const f = n > 1 ? i / (n - 1) : 0
            const [x1, y1] = polar(f, R - 11)
            const [x2, y2] = polar(f, R - 2)
            const [lx, ly] = polar(f, R - 22)
            const inRed = f >= fRed
            const cls = ['rg-tick']
            if (s === value) cls.push('is-on')
            else if (inRed) cls.push('is-red')
            return (
              <g key={s} className={cls.join(' ')}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} />
                <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle">{short(s)}</text>
              </g>
            )
          })}
          {/* ticks menores entre os valores (puramente decorativos) */}
          {steps.length > 1 && steps.slice(0, -1).map((s, i) => {
            const f = (i + 0.5) / (n - 1)
            const [x1, y1] = polar(f, R - 7)
            const [x2, y2] = polar(f, R - 2)
            return <line key={`m${s}`} className="rg-tick-minor" x1={x1} y1={y1} x2={x2} y2={y2} />
          })}

          {/* sublabel gravado estilo manômetro */}
          <text className="rg-sub" x={cx} y={cy - 18} textAnchor="middle">GB · RAM</text>

          {/* ── AGULHA ── */}
          <g className="rg-needle" style={{ transform: `rotate(${rotation}deg)` }}>
            {/* contrapeso (cauda) */}
            <path className="rg-needle-tail" d={`M ${cx - 5} ${cy} L ${cx + 5} ${cy} L ${cx} ${cy + 16} Z`} />
            {/* corpo afilado: largo no hub, ponta fina */}
            <path
              className="rg-needle-body"
              d={`M ${cx - 4.5} ${cy} L ${cx + 4.5} ${cy} L ${cx + 0.9} ${cy - (R - 6)} L ${cx} ${cy - (R - 2)} L ${cx - 0.9} ${cy - (R - 6)} Z`}
              filter="url(#rg-glow)"
            />
          </g>

          {/* ── HUB usinado com fenda de parafuso ── */}
          <circle className="rg-hub" cx={cx} cy={cy} r="9" />
          <circle className="rg-hub-ring" cx={cx} cy={cy} r="9" />
          <line className="rg-hub-slot" x1={cx - 4.5} y1={cy} x2={cx + 4.5} y2={cy} />

          {/* ── PARAFUSOS DO ARO ── */}
          {screws.map((sc, i) => (
            <g key={i} className="rg-screw" transform={`translate(${sc.x} ${sc.y})`}>
              <circle className="rg-screw-base" r="4.6" />
              <circle className="rg-screw-head" r="3.4" />
              <line className="rg-screw-slot" x1={-2.4} y1="0" x2={2.4} y2="0"
                transform={`rotate(${sc.a})`} />
            </g>
          ))}

          {/* reflexo de vidro sobre a face */}
          <path className="rg-glass" d={arcPath(0.12, 0.62, R - 14)} />
        </svg>
      </div>

      <div className="ram-readout">
        <span className="ram-label">Memória RAM</span>
        <span className="ram-value">{label(value)}</span>
      </div>

      <input
        type="range"
        min={0}
        max={Math.max(0, n - 1)}
        step={0.01}
        value={fi}
        onChange={(e) => {
          // barrinha snapa em GB inteiro (1024) → readout sempre "N GB", sem valor quebrado.
          // valor exato (ex: 8448 MB) só pela engrenagem.
          const mb = mbOfFracIndex(Number(e.target.value), steps)
          onChange(clampMb(Math.round(mb / 1024) * 1024, min, max))
        }}
        className="ram-input"
        style={{ '--pct': `${frac * 100}%` }}
        aria-label="Memória RAM"
      />

      {editing && createPortal(
        <div ref={popRef} className="ram-config-pop" style={{ top: pop.top, left: pop.left }}>
          <span className="panel-tex" style={{ backgroundImage: `url(${metalPlate02Tex})` }} aria-hidden="true" />
          <span className="ram-config-title">Memória (MB)</span>
          <div className="ram-config-row">
            <input
              type="text"
              inputMode="numeric"
              className="ram-config-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
              autoFocus
            />
            <button type="button" className="ram-config-ok" onClick={commit}>OK</button>
          </div>
          <span className="ram-config-hint">{min} – {max} MB · ex: 1024, 6144</span>
        </div>,
        document.body
      )}
    </div>
  )
}
