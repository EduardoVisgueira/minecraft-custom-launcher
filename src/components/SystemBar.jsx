import { useState, useEffect } from 'react'
import WindowControls from './WindowControls'
import biohazardIcon from '../../assets/game-icons/lorc_biohazard.svg'
import metalPlateTex from '../../assets/textures/metal_plate_02.jpg'
import './SystemBar.css'

// Relógio ao vivo HH:MM:SS (atualiza a cada segundo). Cara de readout de OS.
function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/**
 * Barra de sistema (system bar) no topo — cara de barra de OS de búnker.
 * É a zona de arrasto do frameless (-webkit-app-region: drag); os botões e
 * o logo ficam no-drag. `operator` opcional (username) e `online` (status).
 */
export default function SystemBar({ name = 'MC Launcher', operator, online = true }) {
  const clock = useClock()

  return (
    <div
      className="system-bar"
      style={{ '--sysbar-tex': `url(${metalPlateTex})` }}
    >
      <div className="system-bar-overlay" aria-hidden="true" />

      {/* Readout central de status do sistema */}
      <div className="sysbar-status">
        <span className={`sysbar-stat sysbar-stat--power ${online ? 'is-online' : 'is-offline'}`}>
          {online ? 'SISTEMA ONLINE' : 'SISTEMA OFFLINE'}
        </span>
        <span className="sysbar-sep" aria-hidden="true">·</span>
        <span className="sysbar-stat sysbar-clock">{clock}</span>
      </div>

      {/* Empurra os controles para a direita e mantém a área de arrasto */}
      <div className="sysbar-drag" />

      <WindowControls />
    </div>
  )
}
