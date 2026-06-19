import AccountSelector from './AccountSelector'
import SocialLinks from './SocialLinks'
import radioactiveIcon from '../../assets/game-icons/lorc_radioactive.svg'
import rustyMetal02Tex from '../../assets/textures/rusty_metal_02.jpg'
import './StatusBar.css'

/**
 * Barra de status no rodapé (status bar de OS). Linha fina com indicadores:
 * ● online/offline, conta logada (AccountSelector compacto), versão do
 * launcher e o setor. Mantém todos os handlers de conta intactos.
 */
export default function StatusBar({ account, config, online = true, onLogout, onAccountChange }) {
  const version = config?.launcher_version || config?.version || '1.0'

  return (
    <footer className="status-bar">
      {/* Chapa de aço enferrujado sob a barra (blend + overlay escuro) */}
      <span className="panel-tex status-bar-tex" style={{ backgroundImage: `url(${rustyMetal02Tex})` }} aria-hidden="true" />
      <div className="status-left">
        <span className="status-item status-account-label">
          conta:
          <AccountSelector
            account={account}
            onLogout={onLogout}
            onAccountChange={onAccountChange}
            compact
          />
        </span>
      </div>

      <div className="status-right">
        {/* Ícones de Discord/site/etc. (do social_links da config) — à esquerda do SETOR */}
        <SocialLinks links={config?.social_links} variant="icons" className="status-socials" />
        <span className="status-item status-sector">
          <span
            className="status-sector-icon"
            style={{ '--icon': `url(${radioactiveIcon})` }}
            aria-hidden="true"
          />
          SETOR 7
        </span>
      </div>
    </footer>
  )
}
