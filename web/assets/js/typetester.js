// Live type tester + copy buttons.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-tester]').forEach((root) => {
    const area = root.querySelector('.tester-area')
    const sizeInput = root.querySelector('[data-control="size"]')
    const trackInput = root.querySelector('[data-control="tracking"]')
    const weightInput = root.querySelector('[data-control="weight"]')
    const styleInput = root.querySelector('[data-control="style"]')
    const sizeVal = root.querySelector('[data-value="size"]')
    const trackVal = root.querySelector('[data-value="tracking"]')

    const apply = () => {
      if (sizeInput) {
        area.style.fontSize = `${sizeInput.value}px`
        if (sizeVal) sizeVal.textContent = `${sizeInput.value}px`
      }
      if (trackInput) {
        area.style.letterSpacing = `${trackInput.value}em`
        if (trackVal) trackVal.textContent = `${(+trackInput.value).toFixed(3)}`
      }
      if (weightInput) area.style.fontWeight = weightInput.value
      if (styleInput) area.style.fontStyle = styleInput.value
    }

    ;[sizeInput, trackInput, weightInput, styleInput].forEach((el) => {
      if (el) el.addEventListener('input', apply)
    })
    apply()
  })

  document.querySelectorAll('.snippet .copy').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pre = btn.parentElement
      const text = pre.textContent.replace(/copy$/i, '').trim()
      navigator.clipboard.writeText(text).then(() => {
        const orig = btn.textContent
        btn.textContent = 'copied'
        setTimeout(() => { btn.textContent = orig }, 1200)
      }).catch(() => {})
    })
  })
})
