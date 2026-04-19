/**
 * WOFF 1.0 wrapper for any sfnt-format font (.ttf or .otf).
 * Spec: https://www.w3.org/TR/WOFF/
 */

import { deflateSync } from 'node:zlib'
import { pad4 } from './sfnt.ts'

export function sfntToWoff(sfnt: Buffer): Buffer {
  const sfntVersion = sfnt.readUInt32BE(0)
  const numTables = sfnt.readUInt16BE(4)

  interface TableEntry {
    tag: number
    checksum: number
    origOffset: number
    origLength: number
    compData: Buffer
  }

  const tables: TableEntry[] = []
  let totalSfntSize = 12 + numTables * 16
  for (let i = 0; i < numTables; i++) {
    const dirOffset = 12 + i * 16
    const tag = sfnt.readUInt32BE(dirOffset)
    const checksum = sfnt.readUInt32BE(dirOffset + 4)
    const origOffset = sfnt.readUInt32BE(dirOffset + 8)
    const origLength = sfnt.readUInt32BE(dirOffset + 12)
    const data = sfnt.subarray(origOffset, origOffset + origLength)
    const compressed = deflateSync(data)
    const compData = compressed.length < origLength ? compressed : data
    tables.push({ tag, checksum, origOffset, origLength, compData })
    totalSfntSize += pad4(origLength)
  }

  const headerSize = 44
  const directorySize = numTables * 20

  let totalCompSize = headerSize + directorySize
  const compEntries: { offset: number, comp: Buffer }[] = []
  for (const t of tables) {
    compEntries.push({ offset: totalCompSize, comp: t.compData })
    totalCompSize += pad4(t.compData.length)
  }

  const out = Buffer.alloc(totalCompSize)
  out.write('wOFF', 0, 'ascii')
  out.writeUInt32BE(sfntVersion, 4)
  out.writeUInt32BE(totalCompSize, 8)
  out.writeUInt16BE(numTables, 12)
  out.writeUInt16BE(0, 14)
  out.writeUInt32BE(totalSfntSize, 16)
  out.writeUInt16BE(1, 20)
  out.writeUInt16BE(0, 22)
  out.writeUInt32BE(0, 24)
  out.writeUInt32BE(0, 28)
  out.writeUInt32BE(0, 32)
  out.writeUInt32BE(0, 36)
  out.writeUInt32BE(0, 40)

  for (let i = 0; i < tables.length; i++) {
    const t = tables[i]!
    const e = compEntries[i]!
    const dir = headerSize + i * 20
    out.writeUInt32BE(t.tag, dir)
    out.writeUInt32BE(e.offset, dir + 4)
    out.writeUInt32BE(e.comp.length, dir + 8)
    out.writeUInt32BE(t.origLength, dir + 12)
    out.writeUInt32BE(t.checksum, dir + 16)
  }
  for (let i = 0; i < tables.length; i++) {
    const e = compEntries[i]!
    e.comp.copy(out, e.offset)
  }
  return out
}
