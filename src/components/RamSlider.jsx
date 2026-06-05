import './RamSlider.css'

const STEPS = [1024, 2048, 3072, 4096, 6144, 8192, 12288, 16384]

function label(mb) {
  return mb >= 1024 ? `${mb / 1024}GB` : `${mb}MB`
}

export default function RamSlider({ value, min, max, onChange }) {
  const steps = STEPS.filter(s => s >= min && s <= max)

  return (
    <div className="ram-slider">
      <div className="ram-header">
        <span className="ram-label">RAM</span>
        <span className="ram-value">{label(value)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={steps.length - 1}
        value={steps.indexOf(value) >= 0 ? steps.indexOf(value) : 0}
        onChange={e => onChange(steps[Number(e.target.value)])}
        className="ram-input"
      />
      <div className="ram-ticks">
        {steps.map(s => (
          <span key={s} className={s === value ? 'tick active' : 'tick'}>{label(s)}</span>
        ))}
      </div>
    </div>
  )
}
