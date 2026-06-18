import './TitleBar.css'

export default function TitleBar({ title }) {
  return (
    <div className="titlebar">
      <div className="titlebar-brand">
        <span className="titlebar-title">{title}</span>
      </div>
      <div className="titlebar-drag" />
      <div className="titlebar-controls">
        <button
          className="tbar-btn tbar-min"
          onClick={() => window.electronAPI.windowMinimize()}
          title="Minimizar"
        >
          <svg width="11" height="11" viewBox="0 0 12 12">
            <rect x="1.5" y="5.5" width="9" height="1.2" rx="0.6" fill="currentColor" />
          </svg>
        </button>
        <button
          className="tbar-btn tbar-max"
          onClick={() => window.electronAPI.windowMaximize()}
          title="Maximizar"
        >
          <svg width="11" height="11" viewBox="0 0 12 12">
            <rect x="2" y="2" width="8" height="8" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
        <button
          className="tbar-btn tbar-close"
          onClick={() => window.electronAPI.windowClose()}
          title="Fechar"
        >
          <svg width="11" height="11" viewBox="0 0 12 12">
            <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
