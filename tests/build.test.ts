/**
 * Build smoke tests for the parametric families.
 */

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import PNG from '@stacksjs/ts-png'
import { Resvg } from '@stacksjs/ts-svg'
import { describe, expect, test } from 'bun:test'
import { parse, readGposKerning, readGsubFeatures, readLayoutHeader, TTFReader } from 'ts-fonts'
import { ALL_FAMILIES, FAMILY_DISPLAY } from '../scripts/lib/common.ts'

const FONTS_DIR = resolve(import.meta.dir, '..', 'fonts')

function countLargeInkComponents(pngBytes: Uint8Array): number {
  const img = PNG.sync.read(Buffer.from(pngBytes))
  const { width, height, data } = img
  const ink = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4]!
    const g = data[i * 4 + 1]!
    const b = data[i * 4 + 2]!
    const a = data[i * 4 + 3]!
    if (a > 80 && r + g + b < 620) ink[i] = 1
  }

  const seen = new Uint8Array(width * height)
  const qx = new Int32Array(width * height)
  const qy = new Int32Array(width * height)
  let large = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      if (!ink[idx] || seen[idx]) continue

      let head = 0
      let tail = 0
      let count = 0
      let minX = x, maxX = x, minY = y, maxY = y
      seen[idx] = 1
      qx[tail] = x
      qy[tail++] = y

      while (head < tail) {
        const cx = qx[head]!
        const cy = qy[head++]!
        count++
        if (cx < minX) minX = cx
        if (cx > maxX) maxX = cx
        if (cy < minY) minY = cy
        if (cy > maxY) maxY = cy

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue
            const nx = cx + dx
            const ny = cy + dy
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
            const ni = ny * width + nx
            if (ink[ni] && !seen[ni]) {
              seen[ni] = 1
              qx[tail] = nx
              qy[tail++] = ny
            }
          }
        }
      }

      const componentWidth = maxX - minX + 1
      const componentHeight = maxY - minY + 1
      if (count > 900 && componentWidth > 30 && componentHeight > 40) large++
    }
  }

  return large
}

describe('built artifacts exist', () => {
  for (const id of ALL_FAMILIES) {
    const meta = FAMILY_DISPLAY[id]
    const base = `${meta.file}-Regular`
    test(`${id}/otf/${base}.otf`, () => {
      expect(existsSync(resolve(FONTS_DIR, id, 'otf', `${base}.otf`))).toBe(true)
    })
    test(`${id}/ttf/${base}.ttf`, () => {
      expect(existsSync(resolve(FONTS_DIR, id, 'ttf', `${base}.ttf`))).toBe(true)
    })
    test(`${id}/woff/${base}.woff`, () => {
      expect(existsSync(resolve(FONTS_DIR, id, 'woff', `${base}.woff`))).toBe(true)
    })
    test(`${id}/woff2/${base}.woff2`, () => {
      expect(existsSync(resolve(FONTS_DIR, id, 'woff2', `${base}.woff2`))).toBe(true)
    })
  }
})

describe('fonts re-parse cleanly', () => {
  for (const id of ALL_FAMILIES) {
    const meta = FAMILY_DISPLAY[id]
    const base = `${meta.file}-Regular`
    test(`${id}`, async () => {
      const buf = await Bun.file(resolve(FONTS_DIR, id, 'otf', `${base}.otf`)).arrayBuffer()
      const font = parse(buf)
      expect(font.unitsPerEm).toBeGreaterThan(0)
      expect(font.numGlyphs).toBeGreaterThan(20)
    })
  }
})

describe('family name matches manifest', () => {
  for (const id of ALL_FAMILIES) {
    const meta = FAMILY_DISPLAY[id]
    const base = `${meta.file}-Regular`
    test(`${id}`, async () => {
      const buf = await Bun.file(resolve(FONTS_DIR, id, 'otf', `${base}.otf`)).arrayBuffer()
      const font = parse(buf)
      expect(font.familyName).toBe(meta.display)
    })
  }
})

describe('copyright includes NPS Fonts credit', () => {
  for (const id of ALL_FAMILIES) {
    const meta = FAMILY_DISPLAY[id]
    const base = `${meta.file}-Regular`
    test(`${id}`, async () => {
      const buf = await Bun.file(resolve(FONTS_DIR, id, 'otf', `${base}.otf`)).arrayBuffer()
      const font = parse(buf)
      const cr = (font.data.name.copyright as string) ?? ''
      expect(cr.length).toBeGreaterThan(20)
      expect(cr).toContain('NPS Fonts')
      expect(cr).toContain(meta.display)
    })
  }
})

describe('NPS Symbols: pictographs at expected codepoints', () => {
  const expected = [
    [0xE000, 'arrowhead'],
    [0xE001, 'mountain'],
    [0xE002, 'tent'],
    [0xE003, 'campfire'],
    [0xE005, 'compass'],
    [0xE006, 'sun'],
  ] as const
  test('all PUA + ASCII shortcuts present', async () => {
    const buf = await Bun.file(resolve(FONTS_DIR, 'nps-symbols', 'otf', 'NPSSymbols-Regular.otf')).arrayBuffer()
    const font = parse(buf)
    expect(font.familyName).toBe('NPS Symbols')
    for (const [cp, name] of expected) {
      const g = font.charToGlyph(String.fromCodePoint(cp))
      expect(g.name).toBe(name)
    }
    expect(font.charToGlyph('M').name).toBe('mountain')
    expect(font.charToGlyph('A').name).toBe('arrowhead')
    expect(font.charToGlyph('T').name).toBe('tent')
  })
})

describe('Campmate Script: GSUB liga is present', () => {
  const expectedSourceLigatures = [
    'ax', 'br', 'bs', 'er', 'ex', 'ix', 'll', 'nx', 'or', 'os',
    'oss', 'ox', 'oz', 'rx', 'ux', 'wr', 'ws', 'yx', 'zz',
  ]

  const connectedCampmatePairs = [
    'as', 'bs', 'cs', 'ds', 'es', 'fs', 'gs', 'hs', 'is', 'ks', 'ls', 'ms', 'ns', 'os', 'ps', 'rs',
    'ss', 'ts', 'us', 'ws', 'xs', 'ys', 'oss',
    'ax', 'ex', 'ix', 'nx', 'ox', 'px', 'rx', 'sx', 'tx', 'ux', 'wx', 'yx', 'yz',
  ]

  test('GSUB table with liga feature exists', async () => {
    const buf = await Bun.file(resolve(FONTS_DIR, 'campmate-script', 'ttf', 'CampmateScript-Regular.ttf')).arrayBuffer()
    const ttf = new TTFReader().read(buf)
    expect(ttf.rawTables?.GSUB).toBeDefined()
    // Parse GSUB → ligature lookups via the layout-common machinery.
    const gsubBytes = ttf.rawTables!.GSUB!
    const gsubAb = new ArrayBuffer(gsubBytes.byteLength)
    new Uint8Array(gsubAb).set(gsubBytes)
    const view = new DataView(gsubAb)
    const header = readLayoutHeader(view, 0)
    const features = readGsubFeatures(view, header, ['liga'])
    expect(features.ligatures.length).toBeGreaterThanOrEqual(expectedSourceLigatures.length)
    const gidByName = new Map(ttf.glyf.map((g, i) => [g.name, i]))
    const hasLigature = (components: string[], by: string) => {
      const first = gidByName.get(components[0]!)
      const rest = components.slice(1).map(name => gidByName.get(name))
      const target = gidByName.get(by)
      return features.ligatures.some(l =>
        l.first === first
        && l.by === target
        && l.components.length === rest.length
        && l.components.every((gid, i) => gid === rest[i])
      )
    }
    for (const name of expectedSourceLigatures) {
      expect(hasLigature([...name], `${name}.liga`)).toBe(true)
    }
    for (const l of features.ligatures) {
      expect(l.by).toBeGreaterThan(0)
      expect(l.first).toBeGreaterThan(0)
      for (const s of l.components) expect(s).toBeGreaterThan(0)
    }
  })

  test('GPOS kerning restores reference script rhythm', async () => {
    const buf = await Bun.file(resolve(FONTS_DIR, 'campmate-script', 'ttf', 'CampmateScript-Regular.ttf')).arrayBuffer()
    const ttf = new TTFReader().read(buf)
    expect(ttf.rawTables?.GPOS).toBeDefined()
    const gposBytes = ttf.rawTables!.GPOS!
    const gposAb = new ArrayBuffer(gposBytes.byteLength)
    new Uint8Array(gposAb).set(gposBytes)
    const view = new DataView(gposAb)
    const header = readLayoutHeader(view, 0)
    const kern = readGposKerning(view, header)
    expect(kern).toBeDefined()

    const gidByName = new Map(ttf.glyf.map((g, i) => [g.name, i]))
    const kernFor = (left: string, right: string) =>
      kern!.getKerningValue(gidByName.get(left)!, gidByName.get(right)!)

    expect(kernFor('a', 's')).toBe(-132)
    expect(kernFor('c', 's')).toBe(-127)
    expect(kernFor('i', 's')).toBe(-109)
    expect(kernFor('n', 'x')).toBe(-110)
    expect(kernFor('w', 's')).toBe(-38)
    expect(kernFor('y', 'z')).toBe(7)
  })

  test('reference-spaced joins render as connected ink', async () => {
    const buf = await Bun.file(resolve(FONTS_DIR, 'campmate-script', 'otf', 'CampmateScript-Regular.otf')).arrayBuffer()
    const font = parse(buf)
    const fontSize = 190
    const padding = 80
    for (const text of connectedCampmatePairs) {
      const path = font.getPath(text, padding, fontSize + padding, fontSize, { features: { liga: true } })
      const advance = font.getAdvanceWidth(text, fontSize, { features: { liga: true } })
      const width = Math.ceil(advance + padding * 2)
      const height = fontSize + padding * 2
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="100%" height="100%" fill="#fff"/>
        ${path.toSVG({ decimalPlaces: 2 }).replace('<path ', '<path fill="#000" ')}
      </svg>`
      const png = new Resvg(svg, { fitTo: { mode: 'zoom', value: 2 } }).render().asPng()
      const componentCount = countLargeInkComponents(png)
      if (componentCount > 1) throw new Error(`${text} rendered as ${componentCount} disconnected ink bodies`)
      expect(componentCount).toBeLessThanOrEqual(1)
    }
  })
})
