import './NewsPanel.css'

export default function NewsPanel({ news = [] }) {
  if (!news.length) {
    return (
      <div className="news-empty">
        <p>Nenhuma novidade por enquanto.</p>
        <span>Configure as notícias no arquivo <code>launcher-config.json</code></span>
      </div>
    )
  }

  return (
    <div className="news-panel">
      <div className="news-header">
        <h3>Novidades</h3>
      </div>
      <div className="news-list">
        {news.map((item, i) => (
          <article key={i} className="news-card">
            <div className="news-meta">
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
