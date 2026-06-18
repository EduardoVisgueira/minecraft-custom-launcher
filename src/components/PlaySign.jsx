import beamUrl from '../../assets/ui/play-beam.png'
import boardUrl from '../../assets/ui/play-board.png'

/**
 * PlaySign — botão JOGAR: letreiro de madeira pendurado (arte pixel-art PNG).
 * São DUAS camadas com o mesmo canvas (1536×1024), então se sobrepõem exatas:
 *  - VIGA (play-beam): fica FIXA no topo (parafusada, não mexe).
 *  - PLACA + CORRENTES (play-board): BALANÇA como pêndulo, girando a partir do
 *    topo (onde as correntes encostam na viga). O texto vai dentro dela p/
 *    balançar junto.
 *
 * Props: label, sub, unlocking (bool), onClick (fn), disabled (bool).
 */
export default function PlaySign({ label = 'JOGAR', sub, unlocking = false, onClick, disabled = false }) {
  return (
    <div className="play-sign-wrap">
      <button
        className={'play-sign' + (unlocking ? ' is-loading' : '')}
        onClick={onClick}
        disabled={disabled}
        aria-label={unlocking ? 'Iniciando' : label}
      >
        {/* viga fixa no topo */}
        <img className="play-sign-beam" src={beamUrl} alt="" draggable="false" />

        {/* placa + correntes: o que balança (e leva o texto junto) */}
        <span className="play-sign-board">
          <img className="play-sign-art" src={boardUrl} alt="" draggable="false" />
          <span className="play-sign-text">
            {unlocking ? (
              <span className="play-sign-line">INICIANDO<span className="dots" /></span>
            ) : (
              <span className="play-sign-line">
                <span className="play-sign-arrow" aria-hidden="true" />
                {label}
              </span>
            )}
          </span>
        </span>
      </button>
      {sub && <span className="mc-play-sub">{sub}</span>}
    </div>
  )
}
