import './TitleBar.css'

export default function TitleBar({ title }) {
  return (
    <div className="titlebar">
      <div className="titlebar-drag" />
      <span className="titlebar-title">{title}</span>
      <div className="titlebar-controls">
        <button
          className="tbar-btn tbar-min"
          onClick={() => window.electronAPI.windowMinimize()}
          title="Minimizar"
        >
          ─
        </button>
        <button
          className="tbar-btn tbar-max"
          onClick={() => window.electronAPI.windowMaximize()}
          title="Maximizar"
        >
          □
        </button>
        <button
          className="tbar-btn tbar-close"
          onClick={() => window.electronAPI.windowClose()}
          title="Fechar"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
