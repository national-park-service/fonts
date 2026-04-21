import opentype from 'opentype.js'
import { writeFile } from 'node:fs/promises'
import { Resvg } from '@resvg/resvg-js'
const buf = await Bun.file('fonts/campmate-script/otf/CampmateScript-Regular.otf').arrayBuffer()
const font = opentype.parse(buf)
for (const ch of ['a', 'b', 'e', 'o', 'n']) {
  const glyph = font.charToGlyph(ch)
  // Move path into a 0-600 viewbox
  const svgPath = glyph.path.toSVG(2)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="-50 -300 600 800"><g transform="scale(1,-1)"><path d="${svgPath.match(/d="([^"]*)"/)?.[1] ?? ''}" fill="#222"/></g></svg>`
  const resvg = new Resvg(svg, { fitTo: { mode: 'zoom', value: 2 } })
  await writeFile(`/tmp/glyph-${ch}.png`, resvg.render().asPng())
  console.log('wrote', ch)
}
