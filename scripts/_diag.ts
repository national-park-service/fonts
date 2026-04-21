import opentype from 'opentype.js'
const buf = await Bun.file('fonts/campmate-script/otf/CampmateScript-Regular.otf').arrayBuffer()
const font = opentype.parse(buf)
const glyph = font.charToGlyph('a')
const svg = glyph.path.toSVG(2)
console.log(svg)
