import { useRef, useState, useEffect } from 'react'
import diamondTex from '../../assets/mc-textures/item_diamond.png'
import appleTex from '../../assets/mc-textures/item_golden_apple.png'
import bookTex from '../../assets/mc-textures/item_book.png'
import pearlTex from '../../assets/mc-textures/item_ender_pearl.png'
// Ícones temáticos (mask, recoloríveis): rádio interceptado + perigo
import signalIcon from '../../assets/game-icons/delapouite_atom-core.svg'
import hazardIcon from '../../assets/game-icons/lorc_hazard-sign.svg'
import barbedWireIcon from '../../assets/game-icons/lorc_barbed-wire.svg'
import './NewsPanel.css'

// Cada card ganha um item do Minecraft que "aparece" no hover (cicla pela lista)
const SPRITES = [diamondTex, appleTex, bookTex, pearlTex]

export default function NewsPanel({ news = [], focusIndex = null }) {
  const cardsRef = useRef([])
  const [highlight, setHighlight] = useState(null)

  useEffect(() => {
    if (focusIndex == null) return
    const el = cardsRef.current[focusIndex]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlight(focusIndex)
      const t = setTimeout(() => setHighlight(null), 1800)
      return () => clearTimeout(t)
    }
  }, [focusIndex])

  if (!news.length) {
    return (
      <div className="news-empty">
        <span className="mask-ic news-empty-ic" style={{ '--icon': `url(${hazardIcon})` }} aria-hidden="true" />
        <p>Nenhuma novidade por enquanto.</p>
        <span>Configure as notícias no arquivo <code>launcher-config.json</code></span>
      </div>
    )
  }

  return (
    <div className="news-panel">
      <div className="news-header">
        <h3>Transmissões Interceptadas</h3>
        <span className="mask-ic news-header-wire" style={{ '--icon': `url(${barbedWireIcon})` }} aria-hidden="true" />
      </div>
      <div className="news-list">
        {news.map((item, i) => (
          <article
            key={i}
            ref={(el) => { cardsRef.current[i] = el }}
            className={'news-card' + (highlight === i ? ' is-focus' : '')}
            style={{ animationDelay: `${Math.min(i * 60, 420)}ms` }}
          >
            {/* Scanline de interferência ao passar o mouse */}
            <span className="news-scan" aria-hidden="true" />
            <img
              src={SPRITES[i % SPRITES.length]}
              alt=""
              className="news-card-sprite"
            />
            <div className="news-meta">
              <span className="mask-ic news-card-ic" style={{ '--icon': `url(${signalIcon})` }} aria-hidden="true" />
              <span className="news-signal">Sinal {String(i + 1).padStart(3, '0')}</span>
              <span className="news-date">{item.date || ''}</span>
            </div>
            <h4 className="news-title">{item.title}</h4>
            <p className="news-body">{item.body}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
