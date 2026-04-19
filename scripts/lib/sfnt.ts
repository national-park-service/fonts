/**
 * Low-level sfnt (TrueType / OpenType container) utilities — read tables
 * from a binary, splice in modifications, recompute checksums.
 *
 * Used by the fork pipeline to rename a font without disturbing any of
 * its other tables (glyf, GPOS, GSUB, kern, etc.). opentype.js's
 * load+save round-trip is lossy for advanced tables, so we splice the
 * `name` table directly instead.
 */

const SFNT_HEADER_SIZE = 12
const DIR_ENTRY_SIZE = 16

export interface SfntTableEntry {
  tag: string         // 4-char ASCII (e.g. 'name', 'glyf')
  tagInt: number      // tag as big-endian uint32
  checksum: number
  offset: number
  length: number
}

export interface ParsedSfnt {
  sfntVersion: number
  numTables: number
  entries: SfntTableEntry[]
  /** Raw buffer (read-only reference). */
  buf: Buffer
}

export function parseSfnt(buf: Buffer): ParsedSfnt {
  const sfntVersion = buf.readUInt32BE(0)
  const numTables = buf.readUInt16BE(4)
  const entries: SfntTableEntry[] = []
  for (let i = 0; i < numTables; i++) {
    const off = SFNT_HEADER_SIZE + i * DIR_ENTRY_SIZE
    const tagInt = buf.readUInt32BE(off)
    const tag = buf.subarray(off, off + 4).toString('ascii')
    entries.push({
      tag,
      tagInt,
      checksum: buf.readUInt32BE(off + 4),
      offset: buf.readUInt32BE(off + 8),
      length: buf.readUInt32BE(off + 12),
    })
  }
  return { sfntVersion, numTables, entries, buf }
}

export function tableData(parsed: ParsedSfnt, tag: string): Buffer | undefined {
  const e = parsed.entries.find(en => en.tag === tag)
  if (!e) return undefined
  return parsed.buf.subarray(e.offset, e.offset + e.length)
}

export function pad4(n: number): number {
  return (n + 3) & ~3
}

/** Compute the sfnt table checksum: sum of big-endian uint32 words, padded to 4 bytes. */
export function tableChecksum(data: Buffer): number {
  const padded = pad4(data.length)
  let sum = 0
  for (let i = 0; i < padded; i += 4) {
    let v = 0
    for (let j = 0; j < 4; j++) {
      const idx = i + j
      v = (v << 8) >>> 0
      if (idx < data.length) v = (v | data[idx]!) >>> 0
    }
    sum = (sum + v) >>> 0
  }
  return sum
}

/**
 * Reassemble an sfnt with a replacement table. If the table existed,
 * its directory entry is updated and existing offsets are repacked. If
 * it didn't, a new entry is added (alphabetical by tag).
 *
 * Then recomputes head.checkSumAdjustment.
 */
export function replaceTable(buf: Buffer, tag: string, newData: Buffer): Buffer {
  const parsed = parseSfnt(buf)
  const tagInt = Buffer.from(tag, 'ascii').readUInt32BE(0)
  const newChecksum = tableChecksum(newData)

  // Build the new entry list. Keep all existing entries except the replaced
  // one (if it existed). Tag order in the directory is alphabetical.
  const newEntries: { tag: string, tagInt: number, checksum: number, length: number, data: Buffer }[] = []
  for (const e of parsed.entries) {
    if (e.tag === tag) continue
    newEntries.push({
      tag: e.tag,
      tagInt: e.tagInt,
      checksum: e.checksum,
      length: e.length,
      data: parsed.buf.subarray(e.offset, e.offset + e.length),
    })
  }
  newEntries.push({ tag, tagInt, checksum: newChecksum, length: newData.length, data: newData })
  newEntries.sort((a, b) => a.tagInt - b.tagInt)

  const numTables = newEntries.length
  const dirSize = SFNT_HEADER_SIZE + numTables * DIR_ENTRY_SIZE

  // Lay out tables in directory order, 4-byte aligned.
  let cursor = dirSize
  const placements: { e: typeof newEntries[number], offset: number }[] = []
  for (const e of newEntries) {
    placements.push({ e, offset: cursor })
    cursor += pad4(e.length)
  }

  const totalLen = cursor
  const out = Buffer.alloc(totalLen)
  // Header
  out.writeUInt32BE(parsed.sfntVersion, 0)
  out.writeUInt16BE(numTables, 4)
  let sr = 1
  let es = 0
  while (sr * 2 <= numTables) { sr *= 2; es++ }
  out.writeUInt16BE(sr * DIR_ENTRY_SIZE, 6)
  out.writeUInt16BE(es, 8)
  out.writeUInt16BE(numTables * DIR_ENTRY_SIZE - sr * DIR_ENTRY_SIZE, 10)
  // Directory
  for (let i = 0; i < placements.length; i++) {
    const { e, offset } = placements[i]!
    const off = SFNT_HEADER_SIZE + i * DIR_ENTRY_SIZE
    out.writeUInt32BE(e.tagInt, off)
    out.writeUInt32BE(e.checksum, off + 4)
    out.writeUInt32BE(offset, off + 8)
    out.writeUInt32BE(e.length, off + 12)
  }
  // Data
  for (const { e, offset } of placements) {
    e.data.copy(out, offset)
  }
  // Recompute head.checkSumAdjustment
  const headPlacement = placements.find(p => p.e.tag === 'head')
  if (headPlacement) {
    out.writeUInt32BE(0, headPlacement.offset + 8) // zero before summing
    let sum = 0
    for (let i = 0; i < pad4(totalLen); i += 4) {
      let v = 0
      for (let j = 0; j < 4; j++) {
        const idx = i + j
        v = (v << 8) >>> 0
        if (idx < totalLen) v = (v | out[idx]!) >>> 0
      }
      sum = (sum + v) >>> 0
    }
    const adjustment = (0xB1B0AFBA - sum) >>> 0
    out.writeUInt32BE(adjustment, headPlacement.offset + 8)
  }
  return out
}
