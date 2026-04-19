/**
 * Read and rebuild the sfnt `name` table.
 *
 * The name table holds family name, style name, full name, postscript
 * name, copyright, license, and so on as multiple platform-specific
 * encodings. To rename a font cleanly, we replace the platform 1 (Mac)
 * and platform 3 (Windows) records for the IDs we care about, leaving
 * everything else untouched.
 *
 * Spec: https://learn.microsoft.com/en-us/typography/opentype/spec/name
 */

const NAME_HEADER_SIZE = 6
const NAME_RECORD_SIZE = 12

interface NameRecord {
  platformID: number
  encodingID: number
  languageID: number
  nameID: number
  /** Decoded string. */
  text: string
}

/** Standard name IDs. */
export const NAME_ID = {
  COPYRIGHT: 0,
  FAMILY: 1,
  SUBFAMILY: 2,
  UNIQUE_ID: 3,
  FULL_NAME: 4,
  VERSION: 5,
  POSTSCRIPT_NAME: 6,
  TRADEMARK: 7,
  MANUFACTURER: 8,
  DESIGNER: 9,
  DESCRIPTION: 10,
  VENDOR_URL: 11,
  DESIGNER_URL: 12,
  LICENSE: 13,
  LICENSE_URL: 14,
  PREFERRED_FAMILY: 16,
  PREFERRED_SUBFAMILY: 17,
} as const

export type NameOverrides = Partial<Record<number, string>>

export function readNameTable(data: Buffer): NameRecord[] {
  if (data.length < NAME_HEADER_SIZE) return []
  const count = data.readUInt16BE(2)
  const stringOffset = data.readUInt16BE(4)
  const records: NameRecord[] = []
  for (let i = 0; i < count; i++) {
    const off = NAME_HEADER_SIZE + i * NAME_RECORD_SIZE
    const platformID = data.readUInt16BE(off)
    const encodingID = data.readUInt16BE(off + 2)
    const languageID = data.readUInt16BE(off + 4)
    const nameID = data.readUInt16BE(off + 6)
    const length = data.readUInt16BE(off + 8)
    const stringStart = stringOffset + data.readUInt16BE(off + 10)
    const raw = data.subarray(stringStart, stringStart + length)
    const text = decodeNameString(raw, platformID)
    records.push({ platformID, encodingID, languageID, nameID, text })
  }
  return records
}

/**
 * Build a fresh name table containing the union of:
 *   - existing records, with overrides applied for IDs in `overrides`
 *   - new platform-1 + platform-3 records for any override IDs that
 *     didn't exist (so they're written even on minimal source fonts)
 */
export function buildNameTable(existing: NameRecord[], overrides: NameOverrides): Buffer {
  // Filter out existing records that we're overriding (Mac+Windows English variants)
  const overrideIds = new Set(Object.keys(overrides).map(Number))
  const kept = existing.filter((r) => {
    if (!overrideIds.has(r.nameID)) return true
    // Drop English Mac (1, 0, 0) and English Windows (3, 1, 0x409) variants
    const isEnglishMac = r.platformID === 1 && r.languageID === 0
    const isEnglishWin = r.platformID === 3 && r.languageID === 0x409
    return !(isEnglishMac || isEnglishWin)
  })

  // Add new English records for each override
  const records: NameRecord[] = [...kept]
  for (const [idStr, text] of Object.entries(overrides)) {
    if (text === undefined) continue
    const nameID = Number(idStr)
    records.push({ platformID: 1, encodingID: 0, languageID: 0, nameID, text })
    records.push({ platformID: 3, encodingID: 1, languageID: 0x409, nameID, text })
  }

  // Sort by (platformID, encodingID, languageID, nameID) — required by spec
  records.sort((a, b) => {
    if (a.platformID !== b.platformID) return a.platformID - b.platformID
    if (a.encodingID !== b.encodingID) return a.encodingID - b.encodingID
    if (a.languageID !== b.languageID) return a.languageID - b.languageID
    return a.nameID - b.nameID
  })

  // Encode each string per its platform; collect into a string heap with dedup.
  const heap: Buffer[] = []
  const heapMap = new Map<string, number>() // hex(bytes) -> offset
  let heapLen = 0
  const encoded: { rec: NameRecord, offset: number, length: number }[] = []
  for (const rec of records) {
    const bytes = encodeNameString(rec.text, rec.platformID)
    const key = bytes.toString('hex')
    let offset = heapMap.get(key)
    if (offset === undefined) {
      offset = heapLen
      heap.push(bytes)
      heapLen += bytes.length
      heapMap.set(key, offset)
    }
    encoded.push({ rec, offset, length: bytes.length })
  }

  const stringOffset = NAME_HEADER_SIZE + records.length * NAME_RECORD_SIZE
  const totalLen = stringOffset + heapLen
  const out = Buffer.alloc(totalLen)
  // Header
  out.writeUInt16BE(0, 0) // format
  out.writeUInt16BE(records.length, 2) // count
  out.writeUInt16BE(stringOffset, 4)
  // Records
  for (let i = 0; i < encoded.length; i++) {
    const { rec, offset, length } = encoded[i]!
    const off = NAME_HEADER_SIZE + i * NAME_RECORD_SIZE
    out.writeUInt16BE(rec.platformID, off)
    out.writeUInt16BE(rec.encodingID, off + 2)
    out.writeUInt16BE(rec.languageID, off + 4)
    out.writeUInt16BE(rec.nameID, off + 6)
    out.writeUInt16BE(length, off + 8)
    out.writeUInt16BE(offset, off + 10)
  }
  // Heap
  let cursor = stringOffset
  for (const b of heap) {
    b.copy(out, cursor)
    cursor += b.length
  }
  return out
}

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

function decodeNameString(raw: Buffer, platformID: number): string {
  if (platformID === 0 || platformID === 3) {
    // UTF-16 BE
    let s = ''
    for (let i = 0; i + 1 < raw.length; i += 2) {
      s += String.fromCharCode(raw.readUInt16BE(i))
    }
    return s
  }
  // Mac: assume Roman/ASCII (good enough for English)
  return raw.toString('latin1')
}

function encodeNameString(text: string, platformID: number): Buffer {
  if (platformID === 0 || platformID === 3) {
    // UTF-16 BE
    const out = Buffer.alloc(text.length * 2)
    for (let i = 0; i < text.length; i++) {
      out.writeUInt16BE(text.charCodeAt(i), i * 2)
    }
    return out
  }
  // Platform 1 (Mac Roman / Latin-1 subset for ASCII strings)
  return Buffer.from(text, 'latin1')
}
