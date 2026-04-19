/**
 * Curated kerning pairs. Values are em-unit horizontal shifts applied
 * between the left and right glyph (negative = tighter).
 *
 * The pairs below are the most-impactful classical kerning targets;
 * a fuller table (1000+ pairs across classes) is the work of months.
 *
 * Per-family scaling is applied at build time (heavier weights tend to
 * need slightly more space).
 */

/** Universal-ish pairs that work across most Latin sans/serif. */
export const COMMON_KERNING: Record<string, number> = {
  // Tight uppercase combinations
  'A,V': -60, 'A,W': -50, 'A,Y': -70, 'A,T': -80, 'A,quoteright': -60,
  'V,A': -60, 'W,A': -50, 'Y,A': -70, 'T,A': -80,
  'F,A': -50, 'P,A': -55, 'L,T': -70, 'L,V': -50, 'L,W': -50, 'L,Y': -60,
  'L,quotedbl': -120, 'L,quoteright': -120,
  'P,comma': -90, 'P,period': -90,
  'V,comma': -100, 'V,period': -100, 'V,colon': -50,
  'W,comma': -90, 'W,period': -90,
  'Y,comma': -110, 'Y,period': -110,
  'T,comma': -100, 'T,period': -100, 'T,colon': -60, 'T,semicolon': -60,
  'F,comma': -100, 'F,period': -100,
  // Uppercase + lowercase
  'T,a': -90, 'T,e': -90, 'T,o': -90, 'T,u': -80, 'T,r': -70, 'T,s': -90, 'T,i': -40, 'T,y': -70,
  'V,a': -50, 'V,e': -50, 'V,o': -50, 'V,u': -40, 'V,r': -40, 'V,y': -30,
  'W,a': -40, 'W,e': -40, 'W,o': -40, 'W,u': -30, 'W,r': -30, 'W,y': -20,
  'Y,a': -70, 'Y,e': -70, 'Y,o': -70, 'Y,u': -50, 'Y,p': -40, 'Y,s': -50,
  'F,a': -40, 'F,e': -40, 'F,o': -40, 'F,r': -30,
  'P,a': -40, 'P,e': -40, 'P,o': -40,
  'L,y': -50,
  // Lowercase rhythm fixes
  'r,comma': -100, 'r,period': -100,
  'f,comma': 30, 'f,period': 30, // anti-collision with the f hook
  'a,v': -20, 'a,w': -20, 'a,y': -20, 'a,t': -10,
  'e,v': -20, 'e,w': -20, 'e,y': -20, 'e,t': -10,
  'o,v': -20, 'o,w': -20, 'o,y': -20, 'o,t': -10, 'o,x': -10,
  'r,t': -20, 'r,v': -20, 'r,w': -20, 'r,y': -20,
  // Punctuation
  'comma,quoteright': -100, 'period,quoteright': -100,
  'quoteleft,quoteleft': -50, 'quoteright,quoteright': -50,
  'quotedbl,quotedbl': -80,
}

/** Heavier kerning for display faces (Switchback, Cairn). */
export const DISPLAY_KERNING: Record<string, number> = (() => {
  const out: Record<string, number> = {}
  for (const [pair, value] of Object.entries(COMMON_KERNING)) {
    out[pair] = Math.round(value * 1.4)
  }
  return out
})()

/** Looser pairs for scripts (Campfire). */
export const SCRIPT_KERNING: Record<string, number> = (() => {
  const out: Record<string, number> = {}
  for (const [pair, value] of Object.entries(COMMON_KERNING)) {
    out[pair] = Math.round(value * 0.6)
  }
  return out
})()
