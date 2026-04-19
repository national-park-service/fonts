// Verify-page controls: size / line-height / tracking sliders that drive
// CSS variables read by every .vline. Persists through localStorage so a
// reload keeps the chosen size.
;(() => {
  const root = document.querySelector('[data-verify-controls]')
  if (!root) return
  const docEl = document.documentElement
  const KEY = 'nps-verify-controls-v1'

  const inputs = {
    vsize: root.querySelector('[data-control="vsize"]'),
    vlh: root.querySelector('[data-control="vlh"]'),
    vtrack: root.querySelector('[data-control="vtrack"]'),
  }
  const values = {
    vsize: root.querySelector('[data-value="vsize"]'),
    vlh: root.querySelector('[data-value="vlh"]'),
    vtrack: root.querySelector('[data-value="vtrack"]'),
  }

  // Restore from localStorage if present.
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (saved) {
      for (const key of Object.keys(inputs)) {
        if (saved[key] != null && inputs[key]) inputs[key].value = saved[key]
      }
    }
  } catch { /* ignore */ }

  const apply = () => {
    const size = inputs.vsize.value
    const lh = inputs.vlh.value
    const track = inputs.vtrack.value
    docEl.style.setProperty('--vline-size', size + 'px')
    docEl.style.setProperty('--vline-lh', lh)
    docEl.style.setProperty('--vline-track', track + 'em')
    values.vsize.textContent = size
    values.vlh.textContent = (+lh).toFixed(2)
    values.vtrack.textContent = (+track).toFixed(3)
    try {
      localStorage.setItem(KEY, JSON.stringify({
        vsize: size, vlh: lh, vtrack: track,
      }))
    } catch { /* ignore */ }
  }

  for (const el of Object.values(inputs)) {
    if (el) el.addEventListener('input', apply)
  }
  apply()
})()
