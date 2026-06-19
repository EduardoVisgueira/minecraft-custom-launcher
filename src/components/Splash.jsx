import grassSideTex from '../../assets/mc-textures/grass_block_side.png'
import grassTopTex from '../../assets/mc-textures/grass_block_top.png'
import dirtTex from '../../assets/mc-textures/dirt.png'
import rustCoarseTex from '../../assets/textures/rust_coarse_01.jpg'
import './Splash.css'

// Tela de sincronização inicial: bloco de grama 3D (texturas reais) girando
// devagar + "Sincronizando..." + barra animada. Se houver logo customizado
// no config, ele tem prioridade sobre o cubo.
export default function Splash({ name, logoUrl }) {
  return (
    <div className="splash">
      {/* Ferrugem grossa cobrindo o búnker inteiro (bem sutil, blend overlay) */}
      <span className="panel-tex splash-tex" style={{ backgroundImage: `url(${rustCoarseTex})` }} aria-hidden="true" />
      <div className="splash-inner">
        <div className="splash-logo">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="splash-logo-img" />
          ) : (
            <div className="splash-cube-scene" aria-hidden="true">
              <div className="splash-cube-tilt">
                <div className="splash-cube">
                  <i className="cube-face cube-face--front" style={{ backgroundImage: `url(${grassSideTex})` }} />
                  <i className="cube-face cube-face--back" style={{ backgroundImage: `url(${grassSideTex})` }} />
                  <i className="cube-face cube-face--right" style={{ backgroundImage: `url(${grassSideTex})` }} />
                  <i className="cube-face cube-face--left" style={{ backgroundImage: `url(${grassSideTex})` }} />
                  <i className="cube-face cube-face--top" style={{ backgroundImage: `url(${grassTopTex})` }} />
                  <i className="cube-face cube-face--bottom" style={{ backgroundImage: `url(${dirtTex})` }} />
                </div>
              </div>
            </div>
          )}
        </div>
        <h1 className="splash-name">{name || 'MC Launcher'}</h1>
        <p className="splash-status">Estabelecendo perímetro…</p>
        <div className="splash-track">
          <div className="splash-fill" />
        </div>
      </div>
    </div>
  )
}
