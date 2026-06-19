import { useState } from 'react'
import chainTex from '../../assets/mc-textures/chain.png'
import lanternTex from '../../assets/mc-textures/lantern.png'
import './McDecor.css'

/**
 * Corrente enferrujada pendurada com a textura real de chain.png (MC 1.20.1).
 * Tema do launcher: metal oxidado + lanterna como luz de emergência.
 *
 * Como funciona:
 * - chain.png é 16×16 com duas tiras de 3px na borda esquerda (frente/lado do
 *   modelo). Mostramos só a primeira tira (coluna 0-2) ampliada 4× — 12px de
 *   largura — com repeat-y, então a corrente emenda perfeitamente na vertical.
 *   Um filtro de ferrugem + rim-glow tóxico garante contraste contra o fundo
 *   (era isso que fazia a corrente "sumir" sobre slides escuros).
 * - Em idle, o pêndulo balança ±1.4° bem devagar. Ao passar o mouse, ele ganha
 *   um "empurrão": uma oscilação que decai naturalmente até repousar
 *   (a animação sempre termina em 0°, então nunca há salto visual).
 * - `lantern` pendura uma lanterna com glow tóxico (verde) que tremula como luz
 *   de emergência; `soul` mantém a mesma lanterna mas com luz de ALERTA
 *   vermelho-sangue (tint via CSS).
 */
/**
 * 4 parafusos 3D nos cantos de uma chapa de metal (decoração pura, sem
 * pointer-events; a técnica `.bolt` vive no global.css). `sm` = cabeças
 * menores p/ chapinhas estreitas. O pai precisa de position:relative.
 */
export function CornerBolts({ sm = false }) {
  const v = sm ? ' bolt--sm' : ''
  return (
    <>
      <span className={`bolt bolt--tl${v}`} aria-hidden="true" />
      <span className={`bolt bolt--tr${v}`} aria-hidden="true" />
      <span className={`bolt bolt--bl${v}`} aria-hidden="true" />
      <span className={`bolt bolt--br${v}`} aria-hidden="true" />
    </>
  )
}

export function HangingChain({ length = 96, lantern = false, soul = false, delay = 0 }) {
  const [swinging, setSwinging] = useState(false)

  const cls = [
    'mc-chain',
    lantern ? 'mc-chain--lantern' : '',
    swinging ? 'is-swinging' : ''
  ].filter(Boolean).join(' ')

  return (
    <div
      className={cls}
      style={{ '--chain-len': `${length}px`, '--sway-delay': `${delay}s` }}
      onMouseEnter={() => setSwinging(true)}
      aria-hidden="true"
    >
      <div
        className="mc-chain-pendulum"
        onAnimationEnd={(e) => {
          // Só o "empurrão" (finito) devolve ao idle; o flicker da lanterna é infinito
          if (e.animationName === 'mcChainSwing') setSwinging(false)
        }}
      >
        <i className="mc-chain-links" style={{ backgroundImage: `url(${chainTex})` }} />
        {lantern && (
          <span className={soul ? 'mc-lantern mc-lantern--soul' : 'mc-lantern'}>
            <i
              className="mc-lantern-sprite"
              style={{ backgroundImage: `url(${lanternTex})` }}
            />
          </span>
        )}
      </div>
    </div>
  )
}
