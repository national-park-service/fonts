// Tiny live type tester. No framework, no build step.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-tester]').forEach((root) => {
    const area = root.querySelector('.tester-area')
    const sizeInput = root.querySelector('[data-control="size"]')
    const trackInput = root.querySelector('[data-control="tracking"]')
    const weightInput = root.querySelector('[data-control="weight"]')
    const styleInput = root.querySelector('[data-control="style"]')

    const apply = () => {
      if (sizeInput) area.style.fontSize = `${sizeInput.value}px`
      if (trackInput) area.style.letterSpacing = `${trackInput.value}em`
      if (weightInput) area.style.fontWeight = weightInput.value
      if (styleInput) area.style.fontStyle = styleInput.value
    }

    ;[sizeInput, trackInput, weightInput, styleInput].forEach((el) => {
      if (el) el.addEventListener('input', apply)
    })
    apply()
  })
})
