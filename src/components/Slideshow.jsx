import { useState, useEffect } from 'react'
import './Slideshow.css'

export default function Slideshow({ images = [], interval = 5000 }) {
  const [current, setCurrent] = useState(0)
  const [loaded, setLoaded] = useState({})

  useEffect(() => {
    if (images.length <= 1) return
    const timer = setInterval(() => {
      setCurrent(prev => (prev + 1) % images.length)
    }, interval)
    return () => clearInterval(timer)
  }, [images, interval])

  if (!images.length) {
    return <div className="slideshow slideshow--empty" />
  }

  return (
    <div className="slideshow">
      {images.map((src, i) => (
        <div
          key={src}
          className={`slide ${i === current ? 'slide--active' : ''}`}
          style={{
            backgroundImage: loaded[i] ? `url(${src})` : 'none'
          }}
        >
          <img
            src={src}
            alt=""
            style={{ display: 'none' }}
            onLoad={() => setLoaded(p => ({ ...p, [i]: true }))}
          />
        </div>
      ))}

      {images.length > 1 && (
        <div className="slideshow-dots">
          {images.map((_, i) => (
            <button
              key={i}
              className={`dot ${i === current ? 'dot--active' : ''}`}
              onClick={() => setCurrent(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
